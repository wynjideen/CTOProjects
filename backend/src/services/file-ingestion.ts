import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import { getConfig } from '../config/loader';
import { getRequestId } from '../lib/logger';
import { AppError, ValidationError, NotFoundError } from '../lib/errors';
import { s3StorageService, S3Metadata } from './s3-storage';
import { jobQueueService, JobData } from './job-queue';
import { fileValidationService, FileMetadata } from './file-validation';
import { databaseService, CreateStudyMaterialData, UploadStatus, ProcessingStatus } from './database';
import { webSocketService } from './websocket';

export interface UploadRequest {
  file: {
    stream: Readable;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  };
  metadata: {
    userId: string;
    courseId?: string;
    documentType?: string;
    tags?: string[];
    description?: string;
  };
}

export interface BatchUploadRequest {
  files: Array<{
    stream: Readable;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }>;
  metadata: {
    userId: string;
    courseId?: string;
    documentType?: string;
    tags?: string[];
    description?: string;
  };
}

export interface UploadResult {
  fileId: string;
  filename: string;
  sizeBytes: number;
  contentType: string;
  uploadStatus: UploadStatus;
  jobId: string;
  createdAt: string;
  processingUrl: string;
}

export interface BatchUploadResult {
  results: UploadResult[];
  totalFiles: number;
  totalSize: number;
  batchJobId: string;
  createdAt: string;
}

export class FileIngestionService {
  private config = getConfig();

  async uploadSingleFile(request: UploadRequest): Promise<UploadResult> {
    const logger = getRequestId();
    const uploadId = uuidv4();
    const fileId = uuidv4();

    try {
      logger.info({ 
        uploadId, 
        filename: request.file.filename, 
        sizeBytes: request.file.sizeBytes,
        userId: request.metadata.userId 
      }, 'Starting single file upload');

      // Validate file metadata
      const fileMetadata: FileMetadata = {
        originalName: request.file.filename,
        mimeType: request.file.mimeType,
        sizeBytes: request.file.sizeBytes,
        userId: request.metadata.userId,
        courseId: request.metadata.courseId,
        documentType: request.metadata.documentType,
        tags: request.metadata.tags,
        description: request.metadata.description,
      };

      const validationResult = await fileValidationService.validateFile(fileMetadata);
      
      if (!validationResult.isValid) {
        throw new ValidationError(`File validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Check for duplicates
      const duplicateCheck = await databaseService.checkDuplicateFile(
        request.metadata.userId,
        request.file.filename,
        request.file.sizeBytes
      );

      if (duplicateCheck.isDuplicate) {
        throw new ValidationError(`Duplicate file detected. File already exists with ID: ${duplicateCheck.existingFileId}`);
      }

      // Sanitize filename
      const sanitizedFilename = fileValidationService.sanitizeFilename(request.file.filename);

      // Generate S3 key
      const s3Key = s3StorageService.generateFileKey(
        request.metadata.userId,
        sanitizedFilename,
        uploadId
      );

      // Create database record
      const createData: CreateStudyMaterialData = {
        filename: sanitizedFilename,
        originalName: request.file.filename,
        contentType: request.file.mimeType,
        sizeBytes: BigInt(request.file.sizeBytes),
        s3Key,
        s3Bucket: this.config.s3Bucket,
        uploadStatus: UploadStatus.UPLOADING,
        processingStatus: ProcessingStatus.PENDING,
        userId: request.metadata.userId,
        courseId: request.metadata.courseId,
        documentType: request.metadata.documentType,
        tags: request.metadata.tags,
        description: request.metadata.description,
      };

      const studyMaterial = await databaseService.createStudyMaterial(createData);

      // Create upload job
      const uploadJobData: JobData = {
        type: 'content-processing',
        payload: {
          fileId: studyMaterial.id,
          userId: request.metadata.userId,
          uploadId,
        },
        priority: 5,
      };

      const uploadJob = await jobQueueService.addJob(uploadJobData);

      // Update file record with job ID
      await databaseService.updateStudyMaterial(studyMaterial.id, {
        uploadJobId: uploadJob.id!.toString(),
      });

      // Send WebSocket progress event
      webSocketService.uploadProgress(studyMaterial.id, request.metadata.userId, 0);

      // Upload to S3
      const s3Metadata: S3Metadata = {
        userId: request.metadata.userId,
        courseId: request.metadata.courseId,
        documentType: request.metadata.documentType,
        originalName: request.file.filename,
        contentType: request.file.mimeType,
        uploadId,
      };

      try {
        const s3Result = await s3StorageService.uploadFile(
          request.file.stream,
          s3Key,
          request.file.mimeType,
          s3Metadata,
          request.file.sizeBytes
        );

        // Update file record with S3 result
        await databaseService.updateStudyMaterial(studyMaterial.id, {
          uploadStatus: UploadStatus.UPLOADED,
          s3Version: s3Result.versionId,
        });

        // Send WebSocket completion event
        webSocketService.uploadComplete(studyMaterial.id, request.metadata.userId, {
          id: studyMaterial.id,
          filename: sanitizedFilename,
          sizeBytes: request.file.sizeBytes,
          contentType: request.file.mimeType,
          s3Location: s3Result.location,
        });

        logger.info({ 
          fileId: studyMaterial.id, 
          s3Key, 
          uploadJobId: uploadJob.id 
        }, 'File upload completed successfully');

        return {
          fileId: studyMaterial.id,
          filename: sanitizedFilename,
          sizeBytes: request.file.sizeBytes,
          contentType: request.file.mimeType,
          uploadStatus: UploadStatus.UPLOADED,
          jobId: uploadJob.id!,
          createdAt: studyMaterial.createdAt.toISOString(),
          processingUrl: `/api/v1/jobs/${uploadJob.id}`,
        };
      } catch (error) {
        // Update file record with error
        await databaseService.updateStudyMaterial(studyMaterial.id, {
          uploadStatus: UploadStatus.VALIDATION_FAILED,
          errorDetails: error instanceof Error ? error.message : 'Unknown upload error',
        });

        // Send WebSocket error event
        webSocketService.uploadError(studyMaterial.id, request.metadata.userId, 
          error instanceof Error ? error.message : 'Upload failed');

        throw error;
      }
    } catch (error) {
      logger.error({ 
        error, 
        uploadId, 
        filename: request.file.filename,
        userId: request.metadata.userId 
      }, 'Single file upload failed');

      if (error instanceof ValidationError || error instanceof AppError) {
        throw error;
      }

      throw new AppError('UPLOAD_ERROR', 500, 'Failed to upload file');
    }
  }

  async uploadBatchFiles(request: BatchUploadRequest): Promise<BatchUploadResult> {
    const logger = getRequestId();
    const batchId = uuidv4();
    const batchJobId = uuidv4();

    try {
      logger.info({ 
        batchId, 
        fileCount: request.files.length,
        userId: request.metadata.userId 
      }, 'Starting batch file upload');

      // Validate batch
      const fileMetadataArray: FileMetadata[] = request.files.map(file => ({
        originalName: file.filename,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        userId: request.metadata.userId,
        courseId: request.metadata.courseId,
        documentType: request.metadata.documentType,
        tags: request.metadata.tags,
        description: request.metadata.description,
      }));

      const batchValidationResult = await fileValidationService.validateBatch(fileMetadataArray);
      
      if (!batchValidationResult.isValid) {
        throw new ValidationError(`Batch validation failed: ${batchValidationResult.errors.join(', ')}`);
      }

      // Process files in parallel with concurrency limit
      const concurrencyLimit = 5;
      const results: UploadResult[] = [];
      let totalSize = 0;

      for (let i = 0; i < request.files.length; i += concurrencyLimit) {
        const chunk = request.files.slice(i, i + concurrencyLimit);
        
        const chunkPromises = chunk.map(async (file, index) => {
          const uploadRequest: UploadRequest = {
            file: {
              stream: file.stream,
              filename: file.filename,
              mimeType: file.mimeType,
              sizeBytes: file.sizeBytes,
            },
            metadata: request.metadata,
          };

          try {
            const result = await this.uploadSingleFile(uploadRequest);
            totalSize += result.sizeBytes;
            return result;
          } catch (error) {
            logger.error({ 
              error, 
              filename: file.filename,
              batchIndex: i + index 
            }, 'Failed to upload file in batch');
            throw error;
          }
        });

        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);
      }

      // Create batch job record
      const batchJobData: JobData = {
        type: 'content-processing',
        payload: {
          batchId,
          fileIds: results.map(r => r.fileId),
          userId: request.metadata.userId,
        },
        priority: 3,
      };

      const batchJob = await jobQueueService.addJob(batchJobData);

      logger.info({
        batchJobId: batchJob.id!.toString(),
        totalFiles: results.length,
        totalSize,
        userId: request.metadata.userId
      }, 'Batch upload completed successfully');

      return {
        results,
        totalFiles: results.length,
        totalSize,
        batchJobId: batchJob.id!.toString(),
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ 
        error, 
        batchId,
        fileCount: request.files.length,
        userId: request.metadata.userId 
      }, 'Batch upload failed');

      if (error instanceof ValidationError || error instanceof AppError) {
        throw error;
      }

      throw new AppError('BATCH_UPLOAD_ERROR', 500, 'Failed to upload batch files');
    }
  }

  async getFile(fileId: string, requestUserId: string): Promise<any> {
    const logger = getRequestId();
    
    try {
      logger.info({ fileId, userId: requestUserId }, 'Getting file metadata');

      const studyMaterial = await databaseService.getStudyMaterial(fileId);

      // Authorization check
      if (studyMaterial.userId !== requestUserId) {
        throw new AppError('Access denied', 'FORBIDDEN', 403);
      }

      // Get job status
      let jobStatus = null;
      if (studyMaterial.processingJobId) {
        jobStatus = await jobQueueService.getJobStatus(studyMaterial.processingJobId);
      }

      const response = {
        file_id: studyMaterial.id,
        filename: studyMaterial.originalName,
        size_bytes: Number(studyMaterial.sizeBytes),
        content_type: studyMaterial.contentType,
        status: studyMaterial.uploadStatus.toLowerCase(),
        metadata: {
          user_id: studyMaterial.userId,
          course_id: studyMaterial.courseId,
          document_type: studyMaterial.documentType,
          tags: studyMaterial.tags,
          description: studyMaterial.description,
        },
        processing_metrics: {
          pages_extracted: studyMaterial.pagesExtracted,
          chunks_created: studyMaterial.chunksCreated,
          processing_time_ms: studyMaterial.processingTimeMs,
          error_details: studyMaterial.errorDetails,
        },
        created_at: studyMaterial.createdAt.toISOString(),
        processed_at: studyMaterial.processedAt?.toISOString() || null,
        job_id: studyMaterial.processingJobId,
        job_status: jobStatus,
      };

      logger.info({ fileId }, 'File metadata retrieved successfully');
      return response;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof AppError) {
        throw error;
      }
      
      logger.error({ error, fileId, userId: requestUserId }, 'Failed to get file');
      throw new AppError('GET_FILE_ERROR', 500, 'Failed to retrieve file');
    }
  }

  async deleteFile(fileId: string, requestUserId: string): Promise<any> {
    const logger = getRequestId();
    
    try {
      logger.info({ fileId, userId: requestUserId }, 'Deleting file');

      const studyMaterial = await databaseService.getStudyMaterial(fileId);

      // Authorization check
      if (studyMaterial.userId !== requestUserId) {
        throw new AppError('Access denied', 'FORBIDDEN', 403);
      }

      // Create deletion job
      const deletionJobData: JobData = {
        type: 'file-deletion',
        payload: {
          fileId,
          s3Key: studyMaterial.s3Key,
          s3Bucket: studyMaterial.s3Bucket,
          s3Version: studyMaterial.s3Version,
          userId: requestUserId,
        },
        priority: 1,
      };

      const deletionJob = await jobQueueService.addJob(deletionJobData);

      // Update file record
      await databaseService.updateStudyMaterial(fileId, {
        uploadStatus: UploadStatus.DELETION_SCHEDULED,
        deletionJobId: deletionJob.id!.toString(),
      });

      // Send WebSocket event
      webSocketService.fileDeleted(fileId, requestUserId);

      const response = {
        file_id: fileId,
        deletion_job_id: deletionJob.id!.toString(),
        status: 'deletion_scheduled',
      };

      logger.info({ fileId, deletionJobId: deletionJob.id }, 'File deletion scheduled');
      return response;
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof AppError) {
        throw error;
      }
      
      logger.error({ error, fileId, userId: requestUserId }, 'Failed to delete file');
      throw new AppError('DELETE_FILE_ERROR', 500, 'Failed to delete file');
    }
  }

  async listUserFiles(userId: string, options: {
    courseId?: string;
    documentType?: string;
    status?: string;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: string;
  } = {}) {
    const logger = getRequestId();
    
    try {
      logger.info({ userId, options }, 'Listing user files');

      const result = await databaseService.listStudyMaterials(userId, {
        courseId: options.courseId,
        documentType: options.documentType,
        status: options.status as any,
        limit: options.limit,
        offset: options.offset,
        sortBy: options.sortBy as any,
        sortOrder: options.sortOrder as any,
      });

      const response = {
        files: result.files.map(file => ({
          file_id: file.id,
          filename: file.originalName,
          size_bytes: Number(file.sizeBytes),
          content_type: file.contentType,
          status: file.uploadStatus.toLowerCase(),
          created_at: file.createdAt.toISOString(),
          course_id: file.courseId,
          document_type: file.documentType,
          processing_status: file.processingStatus.toLowerCase(),
        })),
        total: result.total,
        has_more: result.hasMore,
      };

      logger.info({ userId, count: result.files.length, total: result.total }, 'User files listed successfully');
      return response;
    } catch (error) {
      logger.error({ error, userId, options }, 'Failed to list user files');
      throw new AppError('LIST_FILES_ERROR', 500, 'Failed to list files');
    }
  }
}

export const fileIngestionService = new FileIngestionService();