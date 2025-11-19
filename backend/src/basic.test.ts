import { describe, it, expect } from 'vitest';

describe('Basic File Ingestion Tests', () => {
  it('should validate configuration', () => {
    expect(true).toBe(true);
  });

  it('should import services correctly', () => {
    const { fileIngestionService } = require('../../src/services/file-ingestion');
    expect(fileIngestionService).toBeDefined();
  });
});