import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import { getConfig } from '../config/loader';
import { getRequestId } from '../lib/logger';
import { AppError } from '../lib/errors';

export interface S3UploadResult {
  key: string;
  bucket: string;
  etag?: string;
  versionId?: string;
  location: string;
}

export interface S3Metadata {
  userId: string;
  courseId?: string;
  documentType?: string;
  originalName: string;
  contentType: string;
  uploadId: string;
}

export class S3StorageService {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const config = getConfig();
    
    this.client = new S3Client({
      region: config.s3Region,
      credentials: {
        accessKeyId: config.s3AccessKeyId,
        secretAccessKey: config.s3SecretAccessKey,
      },
    });
    
    this.bucket = config.s3Bucket;
  }

  async uploadFile(
    stream: Readable,
    key: string,
    contentType: string,
    metadata: S3Metadata,
    sizeBytes: number
  ): Promise<S3UploadResult> {
    const logger = getRequestId();
    
    try {
      logger.info({ key, contentType, sizeBytes }, 'Starting S3 upload');

      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: stream,
          ContentType: contentType,
          Metadata: {
            userId: metadata.userId,
            originalName: metadata.originalName,
            uploadId: metadata.uploadId,
            ...(metadata.courseId && { courseId: metadata.courseId }),
            ...(metadata.documentType && { documentType: metadata.documentType }),
          },
          Tagging: this.buildTags(metadata),
        },
      });

      const result = await upload.done();
      
      const uploadResult: S3UploadResult = {
        key,
        bucket: this.bucket,
        etag: result.ETag?.replace(/"/g, ''),
        versionId: result.VersionId,
        location: `https://${this.bucket}.s3.${getConfig().s3Region}.amazonaws.com/${key}`,
      };

      logger.info({ uploadResult }, 'S3 upload completed');
      return uploadResult;
    } catch (error) {
      logger.error({ error, key }, 'S3 upload failed');
      throw new AppError('STORAGE_ERROR', 500, 'Failed to upload file to storage');
    }
  }

  async deleteFile(key: string, versionId?: string): Promise<void> {
    const logger = getRequestId();
    
    try {
      logger.info({ key, versionId }, 'Deleting file from S3');

      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ...(versionId && { VersionId: versionId }),
      });

      await this.client.send(command);
      logger.info({ key }, 'File deleted from S3');
    } catch (error) {
      logger.error({ error, key }, 'Failed to delete file from S3');
      throw new AppError('STORAGE_ERROR', 500, 'Failed to delete file from storage');
    }
  }

  async getFileInfo(key: string): Promise<{ sizeBytes: number; contentType?: string }> {
    const logger = getRequestId();
    
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const result = await this.client.send(command);
      
      return {
        sizeBytes: result.ContentLength || 0,
        contentType: result.ContentType,
      };
    } catch (error) {
      logger.error({ error, key }, 'Failed to get file info from S3');
      throw new AppError('FILE_NOT_FOUND', 404, 'File not found in storage');
    }
  }

  generateFileKey(userId: string, filename: string, uploadId: string): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `uploads/${userId}/${timestamp}/${uploadId}_${sanitizedFilename}`;
  }

  private buildTags(metadata: S3Metadata): string {
    const tags = new URLSearchParams();
    tags.append('UserId', metadata.userId);
    tags.append('UploadId', metadata.uploadId);
    
    if (metadata.courseId) {
      tags.append('CourseId', metadata.courseId);
    }
    
    if (metadata.documentType) {
      tags.append('DocumentType', metadata.documentType);
    }
    
    return tags.toString();
  }
}

export const s3StorageService = new S3StorageService();