import { z } from 'zod';

export const configSchema = z.object({
  port: z.coerce.number().int().positive().default(3000),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  databaseUrl: z.string().url('DATABASE_URL must be a valid connection string'),
  redisUrl: z.string().url('REDIS_URL must be a valid connection string').optional(),
  s3Bucket: z.string().min(1).optional(),
  s3Region: z.string().default('us-east-1'),
  s3AccessKeyId: z.string().min(1).optional(),
  s3SecretAccessKey: z.string().min(1).optional(),
  jwtSecret: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  jwtExpiresIn: z.string().default('24h'),
  oauthProviderUrl: z.string().url('OAUTH_PROVIDER_URL must be valid').optional(),
  llmProvider: z.enum(['openai', 'anthropic', 'azure']).default('openai'),
  llmApiKey: z.string().min(1).optional(),
  llmModel: z.string().default('gpt-4'),
  llmApiBaseUrl: z.string().url().optional(),
  sqsQueueUrl: z.string().url('SQS_QUEUE_URL must be valid').optional(),
  sqsRegion: z.string().default('us-east-1'),
  enableOpenTelemetry: z.boolean().default(false),
  enableDetailedLogging: z.boolean().default(false)
});

export type Config = z.infer<typeof configSchema>;
