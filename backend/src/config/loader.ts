import dotenv from 'dotenv';
import { configSchema, type Config } from './schema';

dotenv.config();

export function loadConfig(): Config {
  const parsed = configSchema.safeParse({
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    s3Bucket: process.env.S3_BUCKET,
    s3Region: process.env.S3_REGION,
    s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN,
    oauthProviderUrl: process.env.OAUTH_PROVIDER_URL,
    llmProvider: process.env.LLM_PROVIDER,
    llmApiKey: process.env.LLM_API_KEY,
    llmModel: process.env.LLM_MODEL,
    llmApiBaseUrl: process.env.LLM_API_BASE_URL,
    sqsQueueUrl: process.env.SQS_QUEUE_URL,
    sqsRegion: process.env.SQS_REGION,
    enableOpenTelemetry: process.env.ENABLE_OTEL === 'true',
    enableDetailedLogging: process.env.ENABLE_DETAILED_LOGGING === 'true',
  });

  if (!parsed.success) {
    console.error('Configuration validation failed:');
    parsed.error.errors.forEach((error) => {
      console.error(`  ${error.path.join('.')}: ${error.message}`);
    });
    process.exit(1);
  }

  return parsed.data;
}

let config: Config | null = null;

export function getConfig(): Config {
  if (!config) {
    config = loadConfig();
  }
  return config;
}
