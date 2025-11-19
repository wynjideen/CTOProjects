import { describe, it, expect } from 'vitest';
import { configSchema } from './config/schema';

describe('configuration schema', () => {
  it('requires secure defaults', () => {
    const result = configSchema.safeParse({
      port: 3000,
      databaseUrl: 'postgresql://localhost:5432/db',
      jwtSecret: 'a'.repeat(32)
    });

    expect(result.success).toBe(true);
  });
});
