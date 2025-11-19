import { getConfig } from '../config/loader';
import { getRequestId } from '../lib/logger';
import { ValidationError, AppError } from '../lib/errors';

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FileMetadata {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  userId: string;
  courseId?: string;
  documentType?: string;
  tags?: string[];
  description?: string;
}

export class FileValidationService {
  private config = getConfig();

  async validateFile(metadata: FileMetadata): Promise<FileValidationResult> {
    const logger = getRequestId();
    const errors: string[] = [];
    const warnings: string[] = [];

    logger.info({ metadata }, 'Validating file');

    // Validate required fields
    if (!metadata.originalName) {
      errors.push('Original filename is required');
    }

    if (!metadata.mimeType) {
      errors.push('Content type is required');
    }

    if (!metadata.userId) {
      errors.push('User ID is required');
    }

    // Validate file size
    if (metadata.sizeBytes <= 0) {
      errors.push('File size must be greater than 0');
    } else if (metadata.sizeBytes > this.config.maxFileSize) {
      errors.push(`File size exceeds maximum allowed size of ${this.formatBytes(this.config.maxFileSize)}`);
    }

    // Validate MIME type
    if (metadata.mimeType && !this.config.allowedMimeTypes.includes(metadata.mimeType)) {
      errors.push(`MIME type ${metadata.mimeType} is not allowed`);
    }

    // Validate filename
    if (metadata.originalName) {
      const filenameErrors = this.validateFilename(metadata.originalName);
      errors.push(...filenameErrors);
    }

    // Validate document type
    if (metadata.documentType) {
      const validDocumentTypes = ['lecture', 'assignment', 'reading', 'exercise', 'reference', 'other'];
      if (!validDocumentTypes.includes(metadata.documentType)) {
        errors.push(`Document type must be one of: ${validDocumentTypes.join(', ')}`);
      }
    }

    // Validate tags
    if (metadata.tags) {
      if (!Array.isArray(metadata.tags)) {
        errors.push('Tags must be an array');
      } else if (metadata.tags.length > 20) {
        errors.push('Maximum 20 tags allowed');
      } else {
        for (const tag of metadata.tags) {
          if (typeof tag !== 'string' || tag.length > 50) {
            errors.push('Each tag must be a string with maximum 50 characters');
            break;
          }
        }
      }
    }

    // Validate description
    if (metadata.description && metadata.description.length > 500) {
      errors.push('Description must be 500 characters or less');
    }

    // Security warnings
    if (metadata.originalName) {
      const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'];
      const extension = this.getFileExtension(metadata.originalName);
      if (suspiciousExtensions.includes(extension)) {
        warnings.push(`File extension ${extension} may be suspicious`);
      }
    }

    const result: FileValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings,
    };

    logger.info({ 
      isValid: result.isValid, 
      errorCount: errors.length, 
      warningCount: warnings.length 
    }, 'File validation completed');

    return result;
  }

  async validateBatch(files: FileMetadata[]): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    fileResults: FileValidationResult[];
    totalSize: number;
  }> {
    const logger = getRequestId();
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    const fileResults: FileValidationResult[] = [];
    let totalSize = 0;

    // Validate batch size
    if (files.length === 0) {
      allErrors.push('Batch cannot be empty');
    } else if (files.length > 50) {
      allErrors.push('Maximum 50 files allowed per batch');
    }

    // Validate total size
    for (const file of files) {
      totalSize += file.sizeBytes;
    }

    if (totalSize > this.config.maxBatchSize) {
      allErrors.push(`Total batch size exceeds maximum allowed size of ${this.formatBytes(this.config.maxBatchSize)}`);
    }

    // Validate individual files
    for (let i = 0; i < files.length; i++) {
      const result = await this.validateFile(files[i]);
      fileResults.push(result);
      
      if (!result.isValid) {
        allErrors.push(...result.errors.map(error => `File ${i + 1}: ${error}`));
      }
      
      allWarnings.push(...result.warnings.map(warning => `File ${i + 1}: ${warning}`));
    }

    const batchResult = {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      fileResults,
      totalSize,
    };

    logger.info({
      fileCount: files.length,
      totalSize,
      isValid: batchResult.isValid,
      errorCount: allErrors.length,
    }, 'Batch validation completed');

    return batchResult;
  }

  async checkDuplicateFile(userId: string, filename: string, sizeBytes: number): Promise<{
    isDuplicate: boolean;
    existingFileId?: string;
  }> {
    // This would typically query the database for existing files
    // For now, we'll implement a placeholder
    const logger = getRequestId();
    
    logger.info({ userId, filename, sizeBytes }, 'Checking for duplicate file');
    
    // Placeholder implementation - in a real system, this would query the database
    // For example: SELECT id FROM study_materials WHERE user_id = $1 AND original_name = $2 AND size_bytes = $3
    
    return {
      isDuplicate: false,
    };
  }

  private validateFilename(filename: string): string[] {
    const errors: string[] = [];
    
    // Check length
    if (filename.length > 255) {
      errors.push('Filename must be 255 characters or less');
    }

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(filename)) {
      errors.push('Filename contains invalid characters');
    }

    // Check for reserved names (Windows)
    const reservedNames = [
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];
    
    const nameWithoutExt = filename.split('.')[0].toUpperCase();
    if (reservedNames.includes(nameWithoutExt)) {
      errors.push('Filename is a reserved system name');
    }

    // Check for path traversal attempts
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      errors.push('Filename contains path traversal sequences');
    }

    return errors;
  }

  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? '.' + parts[parts.length - 1].toLowerCase() : '';
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  sanitizeFilename(filename: string): string {
    // Remove or replace invalid characters
    let sanitized = filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '');

    // Ensure it's not empty after sanitization
    if (sanitized === '') {
      sanitized = 'unnamed_file';
    }

    // Truncate if too long
    if (sanitized.length > 250) {
      const parts = sanitized.split('.');
      if (parts.length > 1) {
        const ext = parts.pop();
        const name = parts.join('.').substring(0, 250 - ext!.length - 1);
        sanitized = name + '.' + ext;
      } else {
        sanitized = sanitized.substring(0, 250);
      }
    }

    return sanitized;
  }
}

export const fileValidationService = new FileValidationService();