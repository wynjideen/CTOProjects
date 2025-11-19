import { PrismaClient, UploadStatus, ProcessingStatus, JobType, JobStatus } from '../generated/prisma';
import { getConfig } from '../config/loader';
import { getDefaultLogger } from '../lib/logger';
import { AppError, NotFoundError } from '../lib/errors';

export interface CreateStudyMaterialData {
  filename: string;
  originalName: string;
  contentType: string;
  sizeBytes: bigint;
  s3Key: string;
  s3Bucket: string;
  s3Version?: string;
  uploadStatus: UploadStatus;
  processingStatus: ProcessingStatus;
  userId: string;
  courseId?: string;
  documentType?: string;
  tags?: string[];
  description?: string;
  uploadJobId?: string;
  processingJobId?: string;
}

export interface UpdateStudyMaterialData {
  filename?: string;
  uploadStatus?: UploadStatus;
  processingStatus?: ProcessingStatus;
  s3Version?: string;
  pagesExtracted?: number;
  chunksCreated?: number;
  processingTimeMs?: number;
  errorDetails?: string;
  uploadJobId?: string;
  processingJobId?: string;
  deletionJobId?: string;
  processedAt?: Date;
}

export interface CreateJobData {
  type: JobType;
  status?: JobStatus;
  priority?: number;
  payload?: any;
  scheduledAt?: Date;
  maxRetries?: number;
}

export interface UpdateJobData {
  status?: JobStatus;
  priority?: number;
  payload?: any;
  result?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  retryCount?: number;
}

export class DatabaseService {
  private prisma: PrismaClient;
  private logger: any;

  constructor() {
    this.logger = getDefaultLogger();
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: getConfig().databaseUrl,
        },
      },
      log: getConfig().enableDetailedLogging ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  async createStudyMaterial(data: CreateStudyMaterialData) {
    try {
      const studyMaterial = await this.prisma.studyMaterial.create({
        data: {
          filename: data.filename,
          originalName: data.originalName,
          contentType: data.contentType,
          sizeBytes: data.sizeBytes,
          s3Key: data.s3Key,
          s3Bucket: data.s3Bucket,
          s3Version: data.s3Version,
          uploadStatus: data.uploadStatus,
          processingStatus: data.processingStatus,
          userId: data.userId,
          courseId: data.courseId,
          documentType: data.documentType,
          tags: data.tags || [],
          description: data.description,
          uploadJobId: data.uploadJobId,
          processingJobId: data.processingJobId,
        },
      });

      this.logger.info({ fileId: studyMaterial.id, userId: data.userId }, 'Study material created');
      return studyMaterial;
    } catch (error) {
      this.logger.error({ error, data }, 'Failed to create study material');
      throw new AppError('Failed to create file record', 'DATABASE_ERROR', 500);
    }
  }

  async getStudyMaterial(id: string) {
    try {
      const studyMaterial = await this.prisma.studyMaterial.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
            },
          },
          course: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      if (!studyMaterial) {
        throw new NotFoundError('File not found');
      }

      return studyMaterial;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      this.logger.error({ error, fileId: id }, 'Failed to get study material');
      throw new AppError('Failed to retrieve file', 'DATABASE_ERROR', 500);
    }
  }

  async getStudyMaterialByS3Key(s3Key: string) {
    const logger = getRequestId();
    
    try {
      const studyMaterial = await this.prisma.studyMaterial.findUnique({
        where: { s3Key },
      });

      return studyMaterial;
    } catch (error) {
      logger.error({ error, s3Key }, 'Failed to get study material by S3 key');
      throw new AppError('Failed to retrieve file', 'DATABASE_ERROR', 500);
    }
  }

  async updateStudyMaterial(id: string, data: UpdateStudyMaterialData) {
    const logger = getRequestId();
    
    try {
      const studyMaterial = await this.prisma.studyMaterial.update({
        where: { id },
        data,
      });

      logger.info({ fileId: id }, 'Study material updated');
      return studyMaterial;
    } catch (error) {
      logger.error({ error, fileId: id, data }, 'Failed to update study material');
      throw new AppError('Failed to update file record', 'DATABASE_ERROR', 500);
    }
  }

  async deleteStudyMaterial(id: string) {
    const logger = getRequestId();
    
    try {
      const studyMaterial = await this.prisma.studyMaterial.delete({
        where: { id },
      });

      logger.info({ fileId: id }, 'Study material deleted');
      return studyMaterial;
    } catch (error) {
      logger.error({ error, fileId: id }, 'Failed to delete study material');
      throw new AppError('Failed to delete file record', 'DATABASE_ERROR', 500);
    }
  }

  async listStudyMaterials(userId: string, options: {
    courseId?: string;
    documentType?: string;
    status?: UploadStatus;
    limit?: number;
    offset?: number;
    sortBy?: 'createdAt' | 'updatedAt' | 'filename' | 'sizeBytes';
    sortOrder?: 'asc' | 'desc';
  } = {}) {
    const logger = getRequestId();
    
    try {
      const {
        courseId,
        documentType,
        status,
        limit = 50,
        offset = 0,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = options;

      const where: any = { userId };
      
      if (courseId) where.courseId = courseId;
      if (documentType) where.documentType = documentType;
      if (status) where.uploadStatus = status;

      const [studyMaterials, total] = await Promise.all([
        this.prisma.studyMaterial.findMany({
          where,
          include: {
            course: {
              select: {
                id: true,
                title: true,
              },
            },
          },
          orderBy: { [sortBy]: sortOrder },
          take: limit,
          skip: offset,
        }),
        this.prisma.studyMaterial.count({ where }),
      ]);

      return {
        files: studyMaterials,
        total,
        hasMore: offset + studyMaterials.length < total,
      };
    } catch (error) {
      logger.error({ error, userId, options }, 'Failed to list study materials');
      throw new AppError('Failed to list files', 'DATABASE_ERROR', 500);
    }
  }

  async createJob(data: CreateJobData) {
    const logger = getRequestId();
    
    try {
      const job = await this.prisma.job.create({
        data: {
          type: data.type,
          status: data.status || JobStatus.PENDING,
          priority: data.priority || 0,
          payload: data.payload,
          scheduledAt: data.scheduledAt || new Date(),
          maxRetries: data.maxRetries || 3,
        },
      });

      logger.info({ jobId: job.id, jobType: data.type }, 'Job created');
      return job;
    } catch (error) {
      logger.error({ error, data }, 'Failed to create job');
      throw new AppError('Failed to create job record', 'DATABASE_ERROR', 500);
    }
  }

  async getJob(id: string) {
    const logger = getRequestId();
    
    try {
      const job = await this.prisma.job.findUnique({
        where: { id },
      });

      if (!job) {
        throw new NotFoundError('Job not found');
      }

      return job;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      logger.error({ error, jobId: id }, 'Failed to get job');
      throw new AppError('Failed to retrieve job', 'DATABASE_ERROR', 500);
    }
  }

  async updateJob(id: string, data: UpdateJobData) {
    const logger = getRequestId();
    
    try {
      const job = await this.prisma.job.update({
        where: { id },
        data,
      });

      logger.info({ jobId: id }, 'Job updated');
      return job;
    } catch (error) {
      logger.error({ error, jobId: id, data }, 'Failed to update job');
      throw new AppError('Failed to update job record', 'DATABASE_ERROR', 500);
    }
  }

  async getJobsByType(type: JobType, status?: JobStatus, limit = 100) {
    const logger = getRequestId();
    
    try {
      const where: any = { type };
      if (status) where.status = status;

      const jobs = await this.prisma.job.findMany({
        where,
        orderBy: { scheduledAt: 'asc' },
        take: limit,
      });

      return jobs;
    } catch (error) {
      logger.error({ error, jobType: type, status }, 'Failed to get jobs by type');
      throw new AppError('Failed to retrieve jobs', 'DATABASE_ERROR', 500);
    }
  }

  async getUserFileStats(userId: string) {
    const logger = getRequestId();
    
    try {
      const stats = await this.prisma.studyMaterial.groupBy({
        by: ['uploadStatus', 'processingStatus'],
        where: { userId },
        _count: {
          id: true,
        },
        _sum: {
          sizeBytes: true,
        },
      });

      const totalFiles = await this.prisma.studyMaterial.count({
        where: { userId },
      });

      return {
        totalFiles,
        stats,
      };
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get user file stats');
      throw new AppError('Failed to retrieve file statistics', 'DATABASE_ERROR', 500);
    }
  }

  async checkDuplicateFile(userId: string, originalName: string, sizeBytes: number) {
    const logger = getRequestId();
    
    try {
      const duplicate = await this.prisma.studyMaterial.findFirst({
        where: {
          userId,
          originalName,
          sizeBytes: BigInt(sizeBytes),
          uploadStatus: {
            not: UploadStatus.DELETED,
          },
        },
      });

      return {
        isDuplicate: !!duplicate,
        existingFileId: duplicate?.id,
      };
    } catch (error) {
      logger.error({ error, userId, originalName, sizeBytes }, 'Failed to check duplicate file');
      throw new AppError('Failed to check for duplicate files', 'DATABASE_ERROR', 500);
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
    const logger = getRequestId();
    logger.info('Database connection closed');
  }
}

export const databaseService = new DatabaseService();