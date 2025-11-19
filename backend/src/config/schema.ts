import { z } from 'zod';

export const configSchema = z.object({
  // Server
  port: z.number().int().positive().default(3000),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Database
  databaseUrl: z.string().url('Invalid DATABASE_URL'),

  // Redis
  redisUrl: z.string().url('Invalid REDIS_URL'),

  // AWS S3
  s3Bucket: z.string().min(1),
  s3Region: z.string().default('us-east-1'),
  s3AccessKeyId: z.string().min(1),
  s3SecretAccessKey: z.string().min(1),

  // Authentication
  jwtSecret: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  jwtExpiresIn: z.string().default('24h'),
  oauthProviderUrl: z.string().url('Invalid OAUTH_PROVIDER_URL').optional(),

  // LLM Provider
  llmProvider: z.enum(['openai', 'anthropic', 'azure']).default('openai'),
  llmApiKey: z.string().min(1),
  llmModel: z.string().default('gpt-4'),
  llmApiBaseUrl: z.string().url().optional(),

  // AWS SQS (for async jobs)
  sqsQueueUrl: z.string().url('Invalid SQS_QUEUE_URL').optional(),
  sqsRegion: z.string().default('us-east-1'),

  // File Upload Limits
  maxFileSize: z.number().int().positive().default(500 * 1024 * 1024), // 500MB
  maxBatchSize: z.number().int().positive().default(2 * 1024 * 1024 * 1024), // 2GB
  allowedMimeTypes: z.array(z.string()).default([
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
  ]),

  // Feature flags
  enableOpenTelemetry: z.boolean().default(false),
  enableDetailedLogging: z.boolean().default(false),
  enableVirusScanning: z.boolean().default(false),
  enableWebSocketEvents: z.boolean().default(true),
});

export type Config = z.infer<typeof configSchema>;
