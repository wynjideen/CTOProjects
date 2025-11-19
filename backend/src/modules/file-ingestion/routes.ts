import type { Router, Request, Response } from 'express';
import multer from 'multer';
import { createAsyncHandler } from '../../middleware/error-handler';
import { fileIngestionService } from '../../services/file-ingestion';
import { 
  uploadMetadataSchema, 
  getFileParamsSchema, 
  deleteFileParamsSchema, 
  listFilesQuerySchema 
} from '../../schemas/file-ingestion';
import { ValidationError } from '../../lib/errors';
import { getRequestId } from '../../lib/logger';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB (will be validated against config)
    files: 10, // Maximum 10 files for batch upload
  },
  fileFilter: (req, file, cb) => {
    // Basic file type validation - more thorough validation happens in the service
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/gif',
      'video/mp4',
      'video/mpeg',
      'audio/mpeg',
      'audio/wav'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ValidationError(`File type ${file.mimetype} is not allowed`));
    }
  },
});

export function setupFileIngestionRoutes(router: Router): void {
  // GET /api/v1/files (list user files) - Must come before parameterized routes
  router.get('/',
    createAsyncHandler(async (req: Request, res: Response) => {
      const logger = getRequestId();
      
      // Validate query parameters
      const query = listFilesQuerySchema.parse(req.query);
      
      // TODO: Get user ID from authentication token
      // For now, we'll use a placeholder
      const userId = req.headers['x-user-id'] as string || 'placeholder-user';
      
      const result = await fileIngestionService.listUserFiles(userId, {
        courseId: query.course_id,
        documentType: query.document_type,
        status: query.status,
        limit: query.limit,
        offset: query.offset,
        sortBy: query.sort_by,
        sortOrder: query.sort_order,
      });
      
      logger.info({ 
        userId, 
        count: result.files.length, 
        total: result.total 
      }, 'User files listed');
      
      res.status(200).json(result);
    })
  );

  // POST /api/v1/files/upload
  router.post('/upload', 
    upload.single('file'),
    createAsyncHandler(async (req: Request, res: Response) => {
      const logger = getRequestId();
      
      if (!req.file) {
        throw new ValidationError('No file provided');
      }

      // Validate metadata
      const metadata = uploadMetadataSchema.parse(req.body);

      // Create stream from buffer
      const { buffer, originalname, mimetype, size } = req.file;
      const stream = require('stream');
      const readableStream = new stream.Readable();
      readableStream.push(buffer);
      readableStream.push(null);

      const result = await fileIngestionService.uploadSingleFile({
        file: {
          stream: readableStream,
          filename: originalname,
          mimeType: mimetype,
          sizeBytes: size,
        },
        metadata: {
          userId: metadata.user_id,
          courseId: metadata.course_id,
          documentType: metadata.document_type,
          tags: metadata.tags,
          description: metadata.description,
        },
      });

      logger.info({ fileId: result.fileId }, 'File upload completed');
      
      res.status(202).json({
        file_id: result.fileId,
        filename: result.filename,
        size_bytes: result.sizeBytes,
        content_type: result.contentType,
        upload_status: result.uploadStatus,
        job_id: result.jobId,
        created_at: result.createdAt,
        processing_url: result.processingUrl,
      });
    })
  );

  // POST /api/v1/files/batch-upload
  router.post('/batch-upload',
    upload.array('files', 10),
    createAsyncHandler(async (req: Request, res: Response) => {
      const logger = getRequestId();
      
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        throw new ValidationError('No files provided');
      }

      // Validate metadata
      const metadata = uploadMetadataSchema.parse(req.body);

      // Create streams from buffers
      const stream = require('stream');
      const fileStreams = files.map(file => {
        const readableStream = new stream.Readable();
        readableStream.push(file.buffer);
        readableStream.push(null);
        
        return {
          stream: readableStream,
          filename: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        };
      });

      const result = await fileIngestionService.uploadBatchFiles({
        files: fileStreams,
        metadata: {
          userId: metadata.user_id,
          courseId: metadata.course_id,
          documentType: metadata.document_type,
          tags: metadata.tags,
          description: metadata.description,
        },
      });

      logger.info({ 
        batchJobId: result.batchJobId,
        totalFiles: result.totalFiles 
      }, 'Batch upload completed');

      res.status(202).json({
        results: result.results.map(r => ({
          file_id: r.fileId,
          filename: r.filename,
          size_bytes: r.sizeBytes,
          content_type: r.contentType,
          upload_status: r.uploadStatus,
          job_id: r.jobId,
          created_at: r.createdAt,
          processing_url: r.processingUrl,
        })),
        total_files: result.totalFiles,
        total_size: result.totalSize,
        batch_job_id: result.batchJobId,
        created_at: result.createdAt,
      });
    })
  );

  // GET /api/v1/files/:fileId
  router.get('/:fileId',
    createAsyncHandler(async (req: Request, res: Response) => {
      const logger = getRequestId();
      
      // Validate parameters
      const params = getFileParamsSchema.parse(req.params);
      
      // TODO: Get user ID from authentication token
      // For now, we'll use a placeholder
      const userId = req.headers['x-user-id'] as string || 'placeholder-user';
      
      const result = await fileIngestionService.getFile(params.file_id, userId);
      
      logger.info({ fileId: params.file_id }, 'File metadata retrieved');
      
      res.status(200).json(result);
    })
  );

  // DELETE /api/v1/files/:fileId
  router.delete('/:fileId',
    createAsyncHandler(async (req: Request, res: Response) => {
      const logger = getRequestId();
      
      // Validate parameters
      const params = deleteFileParamsSchema.parse(req.params);
      
      // TODO: Get user ID from authentication token
      // For now, we'll use a placeholder
      const userId = req.headers['x-user-id'] as string || 'placeholder-user';
      
      const result = await fileIngestionService.deleteFile(params.fileId, userId);
      
      logger.info({ fileId: params.fileId }, 'File deletion scheduled');
      
      res.status(202).json(result);
    })
  );
}