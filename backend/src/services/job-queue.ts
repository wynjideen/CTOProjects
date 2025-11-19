import Bull, { Job, JobOptions, Queue } from 'bull';
import { getConfig } from '../config/loader';
import { getRequestId } from '../lib/logger';

export interface JobData {
  type: 'content-processing' | 'lesson-generation' | 'embedding-generation' | 'virus-scan' | 'file-deletion' | 'progress-snapshot';
  payload: Record<string, any>;
  priority?: number;
  delay?: number;
  attempts?: number;
}

export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class JobQueueService {
  private queue: Queue;
  private isProcessing = false;

  constructor() {
    const config = getConfig();
    
    this.queue = new Bull('file-processing', getConfig().redisUrl, {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const logger = getRequestId();

    this.queue.on('completed', (job: Job, result: JobResult) => {
      logger.info({ jobId: job.id, jobType: job.data.type, result }, 'Job completed');
    });

    this.queue.on('failed', (job: Job, err: Error) => {
      logger.error({ jobId: job.id, jobType: job.data.type, error: err.message }, 'Job failed');
    });

    this.queue.on('stalled', (job: Job) => {
      logger.warn({ jobId: job.id, jobType: job.data.type }, 'Job stalled');
    });

    this.queue.on('progress', (job: Job, progress: number) => {
      logger.debug({ jobId: job.id, jobType: job.data.type, progress }, 'Job progress');
    });
  }

  async addJob(jobData: JobData): Promise<Job> {
    const logger = getRequestId();
    
    const jobOptions: JobOptions = {
      priority: jobData.priority || 0,
      delay: jobData.delay || 0,
      attempts: jobData.attempts || 3,
      removeOnComplete: 100,
      removeOnFail: 50,
    };

    try {
      const job = await this.queue.add(jobData.type, jobData.payload, jobOptions);
      
      logger.info({
        jobId: job.id,
        jobType: jobData.type,
        priority: jobData.priority,
        delay: jobData.delay,
      }, 'Job added to queue');

      return job;
    } catch (error) {
      logger.error({ error, jobData }, 'Failed to add job to queue');
      throw new Error(`Failed to queue job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getJob(jobId: string): Promise<Job | null> {
    try {
      return await this.queue.getJob(jobId);
    } catch (error) {
      const logger = getRequestId();
      logger.error({ error, jobId }, 'Failed to get job');
      return null;
    }
  }

  async getJobStatus(jobId: string): Promise<{
    id: string;
    status: 'waiting' | 'active' | 'completed' | 'failed';
    progress: number;
    result?: any;
    error?: string;
    createdAt: Date;
    processedAt?: Date;
  } | null> {
    const job = await this.getJob(jobId);
    
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress();
    
    return {
      id: job.id!.toString(),
      status: state as 'waiting' | 'active' | 'completed' | 'failed',
      progress: typeof progress === 'number' ? progress : 0,
      result: job.returnvalue,
      error: job.failedReason,
      createdAt: new Date(job.timestamp),
      processedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
    };
  }

  async processJobs(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    const logger = getRequestId();

    logger.info('Starting job processor');

    this.queue.process('content-processing', 5, async (job: Job) => {
      logger.info({ jobId: job.id, payload: job.data }, 'Processing content-processing job');
      // This will be implemented by the content processing service
      return { success: true, message: 'Content processing job queued' };
    });

    this.queue.process('virus-scan', 2, async (job: Job) => {
      logger.info({ jobId: job.id, payload: job.data }, 'Processing virus-scan job');
      // This will be implemented by the virus scanning service
      return { success: true, message: 'Virus scan job queued' };
    });

    this.queue.process('file-deletion', 5, async (job: Job) => {
      logger.info({ jobId: job.id, payload: job.data }, 'Processing file-deletion job');
      // This will be implemented by the file deletion service
      return { success: true, message: 'File deletion job queued' };
    });
  }

  async pauseQueue(): Promise<void> {
    await this.queue.pause();
    const logger = getRequestId();
    logger.info('Job queue paused');
  }

  async resumeQueue(): Promise<void> {
    await this.queue.resume();
    const logger = getRequestId();
    logger.info('Job queue resumed');
  }

  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  }> {
    const waiting = await this.queue.getWaiting();
    const active = await this.queue.getActive();
    const completed = await this.queue.getCompleted();
    const failed = await this.queue.getFailed();
    const delayed = await this.queue.getDelayed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: await this.queue.isPaused(),
    };
  }

  async close(): Promise<void> {
    await this.queue.close();
    const logger = getRequestId();
    logger.info('Job queue closed');
  }
}

export const jobQueueService = new JobQueueService();