import { z } from 'zod';

export const uploadMetadataSchema = z.object({
  user_id: z.string().min(1, 'User ID is required'),
  course_id: z.string().optional(),
  document_type: z.enum(['lecture', 'assignment', 'reading', 'exercise', 'reference', 'other']).optional(),
  tags: z.array(z.string().max(50)).max(20, 'Maximum 20 tags allowed').optional(),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
});

export const batchUploadMetadataSchema = uploadMetadataSchema.extend({
  // Batch uploads can have the same metadata structure
});

export const getFileParamsSchema = z.object({
  file_id: z.string().uuid('Invalid file ID format'),
});

export const deleteFileParamsSchema = z.object({
  file_id: z.string().uuid('Invalid file ID format'),
});

export const listFilesQuerySchema = z.object({
  course_id: z.string().optional(),
  document_type: z.enum(['lecture', 'assignment', 'reading', 'exercise', 'reference', 'other']).optional(),
  status: z.enum(['pending_validation', 'uploading', 'uploaded', 'validation_failed', 'deletion_scheduled', 'deleted']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort_by: z.enum(['createdAt', 'updatedAt', 'filename', 'sizeBytes']).default('createdAt'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export const fileProcessingWebhookSchema = z.object({
  file_id: z.string().uuid(),
  status: z.enum(['pending', 'processing', 'ready', 'partial', 'failed']),
  metrics: z.object({
    pages_extracted: z.number().int().optional(),
    chunks_created: z.number().int().optional(),
    processing_time_ms: z.number().int().optional(),
    error_details: z.string().optional(),
  }).optional(),
});

export type UploadMetadata = z.infer<typeof uploadMetadataSchema>;
export type BatchUploadMetadata = z.infer<typeof batchUploadMetadataSchema>;
export type GetFileParams = z.infer<typeof getFileParamsSchema>;
export type DeleteFileParams = z.infer<typeof deleteFileParamsSchema>;
export type ListFilesQuery = z.infer<typeof listFilesQuerySchema>;
export type FileProcessingWebhook = z.infer<typeof fileProcessingWebhookSchema>;