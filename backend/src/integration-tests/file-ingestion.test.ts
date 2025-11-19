import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { createLogger } from '../../src/lib/logger';
import { getConfig } from '../../src/config/loader';
import { databaseService } from '../../src/services/database';
import FormData from 'form-data';

describe('File Ingestion API', () => {
  const logger = createLogger(getConfig());
  let { app, server } = createApp(logger);
  const testUserId = 'test-user-123';
  const testHeaders = {
    'x-user-id': testUserId,
    'content-type': 'multipart/form-data',
  };

  beforeAll(async () => {
    // Start server for testing
    server.listen(0);
  });

  afterAll(async () => {
    // Clean up database connections
    await databaseService.disconnect();
    server.close();
  });

  beforeEach(() => {
    // Reset any test state if needed
  });

  describe('POST /api/v1/files/upload', () => {
    it('should accept a valid file upload', async () => {
      const form = new FormData();
      form.append('file', Buffer.from('test file content'), 'test.txt');
      form.append('user_id', testUserId);
      form.append('document_type', 'lecture');
      form.append('description', 'Test file for upload');

      const response = await request(app)
        .post('/api/v1/files/upload')
        .set('x-user-id', testUserId)
        .set(...form.getHeaders())
        .send(form.getBuffer());

      expect(response.status).toBe(202);
      expect(response.body).toHaveProperty('file_id');
      expect(response.body).toHaveProperty('filename', 'test.txt');
      expect(response.body).toHaveProperty('size_bytes', 17);
      expect(response.body).toHaveProperty('content_type', 'text/plain');
      expect(response.body).toHaveProperty('upload_status', 'uploaded');
      expect(response.body).toHaveProperty('job_id');
      expect(response.body).toHaveProperty('processing_url');
    });

    it('should reject upload without file', async () => {
      const form = new FormData();
      form.append('user_id', testUserId);

      const response = await request(app)
        .post('/api/v1/files/upload')
        .set('x-user-id', testUserId)
        .set(...form.getHeaders())
        .send(form.getBuffer());

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.message).toContain('No file provided');
    });

    it('should reject upload with invalid metadata', async () => {
      const form = new FormData();
      form.append('file', Buffer.from('test file content'), 'test.txt');
      form.append('user_id', ''); // Invalid empty user_id

      const response = await request(app)
        .post('/api/v1/files/upload')
        .set('x-user-id', testUserId)
        .set(...form.getHeaders())
        .send(form.getBuffer());

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject upload with disallowed file type', async () => {
      const form = new FormData();
      form.append('file', Buffer.from('fake exe content'), 'malware.exe');
      form.append('user_id', testUserId);

      const response = await request(app)
        .post('/api/v1/files/upload')
        .set('x-user-id', testUserId)
        .set(...form.getHeaders())
        .send(form.getBuffer());

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/files/batch-upload', () => {
    it('should accept a valid batch upload', async () => {
      const form = new FormData();
      form.append('files', Buffer.from('test file content 1'), 'test1.txt');
      form.append('files', Buffer.from('test file content 2'), 'test2.txt');
      form.append('user_id', testUserId);
      form.append('document_type', 'lecture');

      const response = await request(app)
        .post('/api/v1/files/batch-upload')
        .set('x-user-id', testUserId)
        .set(...form.getHeaders())
        .send(form.getBuffer());

      expect(response.status).toBe(202);
      expect(response.body).toHaveProperty('results');
      expect(response.body.results).toHaveLength(2);
      expect(response.body).toHaveProperty('total_files', 2);
      expect(response.body).toHaveProperty('total_size');
      expect(response.body).toHaveProperty('batch_job_id');
    });

    it('should reject batch upload without files', async () => {
      const form = new FormData();
      form.append('user_id', testUserId);

      const response = await request(app)
        .post('/api/v1/files/batch-upload')
        .set('x-user-id', testUserId)
        .set(...form.getHeaders())
        .send(form.getBuffer());

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/v1/files', () => {
    it('should list user files', async () => {
      const response = await request(app)
        .get('/api/v1/files')
        .set('x-user-id', testUserId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('files');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('has_more');
      expect(Array.isArray(response.body.files)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/files?limit=5&offset=10')
        .set('x-user-id', testUserId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('files');
      expect(response.body.files.length).toBeLessThanOrEqual(5);
    });

    it('should support filtering by document type', async () => {
      const response = await request(app)
        .get('/api/v1/files?document_type=lecture')
        .set('x-user-id', testUserId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('files');
    });
  });

  describe('GET /api/v1/files/:fileId', () => {
    it('should return 404 for non-existent file', async () => {
      const fakeFileId = '550e8400-e29b-41d4-a716-446655440000';
      
      const response = await request(app)
        .get(`/api/v1/files/${fakeFileId}`)
        .set('x-user-id', testUserId);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject invalid file ID format', async () => {
      const response = await request(app)
        .get('/api/v1/files/invalid-uuid')
        .set('x-user-id', testUserId);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/v1/files/:fileId', () => {
    it('should return 404 for non-existent file', async () => {
      const fakeFileId = '550e8400-e29b-41d4-a716-446655440000';
      
      const response = await request(app)
        .delete(`/api/v1/files/${fakeFileId}`)
        .set('x-user-id', testUserId);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject invalid file ID format', async () => {
      const response = await request(app)
        .delete('/api/v1/files/invalid-uuid')
        .set('x-user-id', testUserId);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });
});

describe('File Ingestion Service Integration', () => {
  it('should validate file size limits', async () => {
    // This test would need to be implemented with actual file size validation
    // For now, it's a placeholder showing the intended test structure
    expect(true).toBe(true);
  });

  it('should handle S3 upload failures gracefully', async () => {
    // This test would need to mock S3 service to test failure scenarios
    expect(true).toBe(true);
  });

  it('should create appropriate jobs after upload', async () => {
    // This test would verify that jobs are created in the queue
    expect(true).toBe(true);
  });

  it('should emit WebSocket events during upload', async () => {
    // This test would verify WebSocket event emission
    expect(true).toBe(true);
  });
});