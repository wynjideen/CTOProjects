# Backend API Specification

**Version:** 1.0.0  
**Last Updated:** 2024  
**Status:** Specification  

## Table of Contents

1. [Overview](#overview)
2. [Service Architecture](#service-architecture)
3. [Module Breakdown](#module-breakdown)
4. [API Versioning Strategy](#api-versioning-strategy)
5. [Core Endpoints](#core-endpoints)
6. [Async Job Management](#async-job-management)
7. [Integration Contracts](#integration-contracts)
8. [Error Handling](#error-handling)
9. [Validation Rules](#validation-rules)
10. [Streaming](#streaming)
11. [Security & Authentication](#security--authentication)

---

## Overview

This specification defines the backend API architecture for a learning management platform with advanced file processing, AI-driven content analysis, and adaptive learning orchestration. The system is designed with clear service boundaries, supporting both synchronous and asynchronous operations.

### Key Characteristics

- **Scalable**: Modular architecture supporting horizontal scaling
- **Async-First**: Heavy operations delegated to background jobs
- **Provider-Agnostic**: Pluggable AI and storage providers
- **Streaming**: Support for large file uploads and real-time processing
- **Observable**: Comprehensive progress tracking and monitoring
- **Resilient**: Fault-tolerant job processing with retry mechanisms

---

## Service Architecture

### Service Boundaries

The backend is organized into the following service domains:

```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway / Router                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   File       │  │   Content    │  │  Learning    │      │
│  │  Ingestion   │  │  Processing  │  │ Orchestration│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │   Progress   │  │   Job        │                         │
│  │   Tracking   │  │   Scheduler  │                         │
│  └──────────────┘  └──────────────┘                         │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐           ┌──────────────────┐        │
│  │  AI Provider     │           │  Storage         │        │
│  │  Integration     │           │  Integration     │        │
│  └──────────────────┘           └──────────────────┘        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Service Interactions

1. **File Ingestion Service** → accepts uploads, validates, stores
2. **Content Processing Service** → extracts metadata, chunks content
3. **Learning Orchestration** → plans learning paths, AI interactions
4. **Progress Tracking** → monitors user/content progress, metrics
5. **Job Scheduler** → manages async task queuing and execution

---

## Module Breakdown

### 1. File Ingestion Module

**Responsibility**: Handle file uploads, validation, storage, and metadata extraction.

#### Endpoints

**POST /api/v1/files/upload**
- Upload a single file with metadata
- Supports streaming uploads for large files
- Returns file reference and processing job ID

**Request:**
```json
{
  "file": "multipart/form-data - binary file content",
  "filename": "string (required)",
  "content_type": "string (e.g., 'application/pdf')",
  "metadata": {
    "user_id": "string (required)",
    "course_id": "string (optional)",
    "document_type": "string (optional, e.g., 'lecture', 'assignment')",
    "tags": ["string"] (optional),
    "description": "string (optional)"
  }
}
```

**Response (202 Accepted):**
```json
{
  "file_id": "uuid",
  "filename": "string",
  "size_bytes": "integer",
  "content_type": "string",
  "upload_status": "pending_validation",
  "job_id": "uuid",
  "created_at": "ISO-8601 timestamp",
  "processing_url": "/api/v1/jobs/{job_id}"
}
```

**POST /api/v1/files/batch-upload**
- Upload multiple files in a single request
- Returns array of file references and consolidated job ID

**GET /api/v1/files/{file_id}**
- Retrieve file metadata and current processing status
- Does not return raw file content

**Response (200 OK):**
```json
{
  "file_id": "uuid",
  "filename": "string",
  "size_bytes": "integer",
  "content_type": "string",
  "status": "string (uploaded|processing|ready|failed)",
  "metadata": {
    "user_id": "string",
    "course_id": "string",
    "document_type": "string",
    "tags": ["string"],
    "description": "string"
  },
  "processing_metrics": {
    "pages_extracted": "integer",
    "chunks_created": "integer",
    "processing_time_ms": "integer",
    "error_details": "string or null"
  },
  "created_at": "ISO-8601 timestamp",
  "processed_at": "ISO-8601 timestamp or null",
  "job_id": "uuid"
}
```

**DELETE /api/v1/files/{file_id}**
- Mark file for deletion (async cleanup)
- Returns confirmation and cleanup job ID

**Response (202 Accepted):**
```json
{
  "file_id": "uuid",
  "deletion_job_id": "uuid",
  "status": "deletion_scheduled"
}
```

#### Processing Pipeline

1. **Upload Reception**: Receive and store file in temporary staging
2. **Validation**: Verify format, size limits, content type
3. **Virus Scanning**: Security scan (if enabled)
4. **Metadata Extraction**: Extract basic file metadata
5. **Chunking**: Divide content into processable chunks
6. **Queue for Content Processing**: Emit event to content processing service

#### File Size Limits

- Single file upload: 500 MB
- Batch upload (combined): 2 GB
- Chunk size: 8 KB - 512 KB (configurable per content type)

---

### 2. Content Processing Module

**Responsibility**: Extract, parse, enrich content from ingested files.

#### Endpoints

**GET /api/v1/content/{file_id}**
- Retrieve processed content structure (not raw content)
- Returns document tree, segments, metadata

**Response (200 OK):**
```json
{
  "file_id": "uuid",
  "content_id": "uuid",
  "title": "string",
  "source_filename": "string",
  "structure": {
    "type": "string (document|presentation|video|interactive)",
    "sections": [
      {
        "section_id": "uuid",
        "title": "string",
        "order": "integer",
        "chunks": [
          {
            "chunk_id": "uuid",
            "content": "string (raw text or description)",
            "content_type": "string (text|code|image|table|formula)",
            "order": "integer",
            "embedding": "vector<1536> (optional, lazy-loaded)",
            "metadata": {
              "language": "string",
              "estimated_reading_time_seconds": "integer",
              "complexity_score": "number (0-1)"
            }
          }
        ]
      }
    ]
  },
  "metadata": {
    "total_chunks": "integer",
    "total_sections": "integer",
    "primary_language": "string",
    "estimated_total_reading_time_seconds": "integer",
    "key_topics": ["string"],
    "difficulty_level": "string (beginner|intermediate|advanced)"
  },
  "processing_status": "string (pending|processing|ready|partial|failed)",
  "created_at": "ISO-8601 timestamp",
  "last_updated_at": "ISO-8601 timestamp"
}
```

**POST /api/v1/content/{file_id}/chunks/{chunk_id}/embed**
- Trigger embedding generation for a specific chunk
- Async operation, returns job reference

**Request:**
```json
{
  "embedding_model": "string (optional, defaults to configured model)",
  "force_regenerate": "boolean (optional, default: false)"
}
```

**Response (202 Accepted):**
```json
{
  "chunk_id": "uuid",
  "embedding_job_id": "uuid",
  "status": "embedding_queued"
}
```

**GET /api/v1/content/{file_id}/chunks/{chunk_id}**
- Retrieve single chunk with optional embedding

**Query Parameters:**
- `include_embedding`: boolean (default: false)
- `embedding_format`: string (dense|sparse, default: dense)

**Response (200 OK):**
```json
{
  "chunk_id": "uuid",
  "section_id": "uuid",
  "file_id": "uuid",
  "content": "string",
  "content_type": "string",
  "order": "integer",
  "metadata": {
    "language": "string",
    "complexity_score": "number",
    "estimated_reading_time_seconds": "integer"
  },
  "embedding": {
    "model": "string",
    "vector": "vector<1536> (if requested)",
    "generated_at": "ISO-8601 timestamp"
  }
}
```

**POST /api/v1/content/search**
- Vector similarity search across all chunks
- Used for learning path recommendation

**Request:**
```json
{
  "query": "string (text query or embedded vector)",
  "query_type": "string (text|vector)",
  "limit": "integer (default: 10, max: 100)",
  "offset": "integer (default: 0)",
  "filters": {
    "user_id": "string (optional)",
    "course_id": "string (optional)",
    "difficulty_level": "string (optional)",
    "content_type": "string (optional)",
    "file_ids": ["uuid"] (optional)
  },
  "threshold": "number (0-1, optional, default: 0.5)"
}
```

**Response (200 OK):**
```json
{
  "query": "string",
  "query_type": "string",
  "results": [
    {
      "chunk_id": "uuid",
      "file_id": "uuid",
      "section_title": "string",
      "content_snippet": "string (first 200 chars)",
      "similarity_score": "number (0-1)",
      "metadata": {
        "language": "string",
        "complexity_score": "number",
        "source_filename": "string"
      }
    }
  ],
  "total_count": "integer",
  "has_more": "boolean"
}
```

---

### 3. Learning Orchestration Module

**Responsibility**: Create and manage learning paths, adaptive lesson plans, and AI-driven interactions.

#### Endpoints

**POST /api/v1/learning-paths**
- Create a new learning path for a user

**Request:**
```json
{
  "user_id": "string (required)",
  "course_id": "string (optional)",
  "title": "string (required)",
  "description": "string (optional)",
  "learning_objectives": ["string"] (optional),
  "initial_assessment_results": {
    "user_knowledge_level": "string (beginner|intermediate|advanced)",
    "learning_style": "string (visual|auditory|kinesthetic|reading-writing)",
    "pace_preference": "string (slow|normal|fast)"
  } (optional)
}
```

**Response (201 Created):**
```json
{
  "path_id": "uuid",
  "user_id": "string",
  "course_id": "string or null",
  "title": "string",
  "description": "string",
  "status": "string (active|paused|completed|archived)",
  "learning_objectives": ["string"],
  "created_at": "ISO-8601 timestamp",
  "estimated_completion_time_days": "integer or null"
}
```

**GET /api/v1/learning-paths/{path_id}**
- Retrieve learning path with current lessons and progress

**Response (200 OK):**
```json
{
  "path_id": "uuid",
  "user_id": "string",
  "title": "string",
  "description": "string",
  "status": "string",
  "lessons": [
    {
      "lesson_id": "uuid",
      "order": "integer",
      "title": "string",
      "learning_objectives": ["string"],
      "estimated_duration_minutes": "integer",
      "content_sources": [
        {
          "chunk_id": "uuid",
          "file_id": "uuid",
          "title": "string",
          "type": "string (reading|video|interactive|exercise)"
        }
      ],
      "assessment": {
        "assessment_id": "uuid",
        "type": "string (quiz|exercise|project)",
        "required": "boolean"
      } or null,
      "status": "string (pending|in_progress|completed|failed)",
      "user_progress": {
        "started_at": "ISO-8601 timestamp or null",
        "completed_at": "ISO-8601 timestamp or null",
        "completion_percentage": "number (0-100)",
        "score": "number (0-100) or null"
      }
    }
  ],
  "overall_progress": {
    "completion_percentage": "number (0-100)",
    "lessons_completed": "integer",
    "total_lessons": "integer",
    "estimated_remaining_days": "integer"
  },
  "adaptations": {
    "last_adapted_at": "ISO-8601 timestamp",
    "difficulty_adjustments": [
      {
        "lesson_id": "uuid",
        "adjusted_from": "string",
        "adjusted_to": "string",
        "reason": "string"
      }
    ]
  }
}
```

**POST /api/v1/learning-paths/{path_id}/lessons**
- Generate new lessons for a learning path (async)
- Triggers AI planning and content selection

**Request:**
```json
{
  "count": "integer (default: 5, max: 20)",
  "focus_areas": ["string"] (optional),
  "override_strategy": "string (optional, sequential|adaptive|spiral|mastery)"
}
```

**Response (202 Accepted):**
```json
{
  "path_id": "uuid",
  "generation_job_id": "uuid",
  "status": "lesson_generation_queued",
  "estimated_wait_time_seconds": "integer"
}
```

**POST /api/v1/lessons/{lesson_id}/complete**
- Mark a lesson as completed with assessment results

**Request:**
```json
{
  "completion_data": {
    "time_spent_seconds": "integer",
    "assessment_result": {
      "score": "number (0-100)",
      "attempts": "integer",
      "feedback": "string (optional)"
    } (optional),
    "user_notes": "string (optional)"
  }
}
```

**Response (200 OK):**
```json
{
  "lesson_id": "uuid",
  "path_id": "uuid",
  "status": "completed",
  "completion_data": {
    "completed_at": "ISO-8601 timestamp",
    "time_spent_seconds": "integer",
    "assessment_result": {
      "score": "number",
      "attempts": "integer"
    } or null
  },
  "next_lesson_recommendation": {
    "lesson_id": "uuid",
    "title": "string",
    "reason": "string (based on performance|learning_style|prerequisites)"
  } or null
}
```

**POST /api/v1/lessons/{lesson_id}/ask**
- Submit question or get clarification from AI during lesson (streaming)

**Request:**
```json
{
  "question": "string (required)",
  "context": {
    "current_section_id": "uuid (optional)",
    "previous_interactions": ["string"] (optional, last 5 Q&As),
    "include_references": "boolean (default: true)"
  }
}
```

**Response (200 OK with Server-Sent Events):**
```
event: chunk
data: {"text": "This is a response... "}

event: chunk
data: {"text": "continued response..."}

event: references
data: {"references": [{"chunk_id": "uuid", "file_id": "uuid", "title": "string", "relevance_score": 0.95}]}

event: complete
data: {"interaction_id": "uuid", "total_tokens": 450}
```

---

### 4. Progress Tracking Module

**Responsibility**: Monitor user progress, learning metrics, and adaptive recommendations.

#### Endpoints

**GET /api/v1/users/{user_id}/progress**
- Retrieve comprehensive user progress across all learning paths

**Query Parameters:**
- `include_paths`: boolean (default: true)
- `include_metrics`: boolean (default: true)
- `time_period`: string (week|month|all, default: all)

**Response (200 OK):**
```json
{
  "user_id": "string",
  "learning_paths": [
    {
      "path_id": "uuid",
      "title": "string",
      "status": "string",
      "completion_percentage": "number (0-100)",
      "lessons_completed": "integer",
      "total_lessons": "integer",
      "average_score": "number (0-100) or null",
      "started_at": "ISO-8601 timestamp",
      "estimated_completion_at": "ISO-8601 timestamp or null"
    }
  ],
  "aggregated_metrics": {
    "total_learning_time_minutes": "integer",
    "average_score": "number (0-100)",
    "lessons_completed": "integer",
    "paths_in_progress": "integer",
    "paths_completed": "integer",
    "current_streak_days": "integer"
  },
  "recommendations": [
    {
      "type": "string (next_path|retry_lesson|alternative_content|challenge)",
      "priority": "string (high|medium|low)",
      "reason": "string",
      "target_id": "uuid",
      "target_type": "string (learning_path|lesson|content_chunk)"
    }
  ]
}
```

**GET /api/v1/paths/{path_id}/metrics**
- Get detailed analytics for a learning path

**Response (200 OK):**
```json
{
  "path_id": "uuid",
  "user_id": "string",
  "metrics": {
    "completion_percentage": "number",
    "total_time_spent_minutes": "integer",
    "lessons_completed": "integer",
    "lessons_in_progress": "integer",
    "average_lesson_score": "number",
    "time_per_lesson_minutes": "number",
    "assessment_attempts": "integer",
    "first_attempt_pass_rate": "number (0-1)",
    "engagement_score": "number (0-100)"
  },
  "lesson_breakdown": [
    {
      "lesson_id": "uuid",
      "title": "string",
      "status": "string",
      "time_spent_minutes": "integer",
      "score": "number",
      "difficulty_rating": "number (1-5)",
      "completed_at": "ISO-8601 timestamp or null"
    }
  ],
  "adaptive_adjustments": [
    {
      "timestamp": "ISO-8601 timestamp",
      "reason": "string",
      "adjustment_type": "string (difficulty_increase|difficulty_decrease|pace_adjustment|content_substitution)",
      "details": "object"
    }
  ]
}
```

**POST /api/v1/progress/snapshot**
- Manually trigger progress snapshot for analytics/reporting

**Request:**
```json
{
  "user_ids": ["string"] (optional, all if omitted),
  "include_aggregates": "boolean (default: true)"
}
```

**Response (202 Accepted):**
```json
{
  "snapshot_job_id": "uuid",
  "status": "snapshot_generation_queued",
  "estimated_wait_time_seconds": "integer"
}
```

---

## API Versioning Strategy

### Version Structure

- **URL-based versioning**: `/api/v{major}/`
- **Current version**: v1
- **Deprecation period**: 12 months minimum before removal

### Backward Compatibility

- New fields are added as optional
- Deprecated fields are marked and supported for 2 major versions
- Breaking changes require major version bump

### Version Response Header

All responses include versioning metadata:

```
X-API-Version: 1.0.0
X-API-Deprecated: false (or specific message if deprecated)
X-API-Sunset: <RFC 7231 date> (if version is sunset)
```

---

## Core Endpoints

### Health & Status

**GET /api/v1/health**
- System health check
- No authentication required

**Response (200 OK):**
```json
{
  "status": "string (healthy|degraded|unhealthy)",
  "timestamp": "ISO-8601 timestamp",
  "version": "string",
  "services": {
    "database": "string (up|down)",
    "cache": "string (up|down)",
    "ai_provider": "string (up|down)",
    "storage": "string (up|down)",
    "queue": "string (up|down)"
  }
}
```

**GET /api/v1/status**
- Detailed system status with metrics
- Requires authentication

**Response (200 OK):**
```json
{
  "status": "string",
  "metrics": {
    "active_jobs": "integer",
    "queued_jobs": "integer",
    "api_latency_ms": "number",
    "database_connections": "integer",
    "cache_hit_rate": "number (0-1)"
  },
  "limits": {
    "concurrent_uploads": "integer",
    "max_file_size_mb": "integer",
    "max_ai_requests_per_minute": "integer"
  }
}
```

---

## Async Job Management

### Job Model

All long-running operations return a job reference.

**Job States:**
```
PENDING → QUEUED → PROCESSING → COMPLETED/FAILED/CANCELLED
```

### Job Polling

**GET /api/v1/jobs/{job_id}**
- Poll for job status

**Response (200 OK):**
```json
{
  "job_id": "uuid",
  "type": "string (file_upload|content_processing|embedding_generation|lesson_generation|snapshot|batch_operation)",
  "status": "string (pending|queued|processing|completed|failed|cancelled)",
  "created_at": "ISO-8601 timestamp",
  "started_at": "ISO-8601 timestamp or null",
  "completed_at": "ISO-8601 timestamp or null",
  "progress": {
    "current": "integer",
    "total": "integer",
    "percentage": "number (0-100)",
    "message": "string"
  },
  "result": {
    "success": "boolean",
    "data": "object (varies by job type)",
    "error": {
      "code": "string",
      "message": "string",
      "details": "object"
    } (if failed)
  }
}
```

### Job Webhooks

**POST /api/v1/webhooks/register**
- Register webhook for job completion events

**Request:**
```json
{
  "url": "string (HTTPS required)",
  "job_types": ["string"] (optional, all if omitted),
  "events": ["string (job_completed|job_failed)"],
  "secret": "string (optional, for HMAC verification)"
}
```

**Response (201 Created):**
```json
{
  "webhook_id": "uuid",
  "url": "string",
  "job_types": ["string"],
  "events": ["string"],
  "created_at": "ISO-8601 timestamp",
  "is_active": "boolean"
}
```

### Job Retry Mechanism

- **Max retries**: 3 (configurable per job type)
- **Backoff strategy**: Exponential with jitter
- **Retry delays**: 5s, 30s, 5m
- **Idempotency key**: Included in request headers for deduplication

---

## Integration Contracts

### AI Provider Integration

**Abstract Provider Interface:**

```
interface AIProvider {
  // Text completion/generation
  generateText(
    prompt: string,
    options: {
      maxTokens?: number,
      temperature?: number,
      model?: string,
      stopSequences?: string[]
    }
  ): Promise<GeneratedText>

  // Embedding generation
  embed(
    texts: string[],
    model?: string
  ): Promise<Vector[]>

  // Streaming text generation
  streamGenerateText(
    prompt: string,
    options: GenerateOptions
  ): AsyncIterable<TextChunk>

  // Batch operations
  batchEmbed(texts: string[]): Promise<BatchJob>

  // Usage tracking
  getUsageMetrics(): Promise<UsageMetrics>
}
```

**Supported Providers:**
- OpenAI (GPT-4, GPT-3.5-turbo, text-embedding-3-large)
- Anthropic Claude (Claude 3 family)
- Google Vertex AI
- Local LLM via Ollama
- Custom provider implementations

**Provider Configuration:**

```json
{
  "provider": "string (openai|anthropic|vertex|ollama|custom)",
  "model": "string",
  "api_key": "string",
  "base_url": "string (optional, for custom/local providers)",
  "max_retries": "integer",
  "timeout_seconds": "integer",
  "rate_limit_requests_per_minute": "integer"
}
```

### Storage Provider Integration

**Abstract Storage Interface:**

```
interface StorageProvider {
  // File operations
  uploadFile(key: string, buffer: Buffer, metadata: object): Promise<string>
  downloadFile(key: string): Promise<Buffer>
  deleteFile(key: string): Promise<void>
  fileExists(key: string): Promise<boolean>
  getFileMetadata(key: string): Promise<FileMetadata>

  // Batch operations
  uploadBatch(files: FileSpec[]): Promise<BatchUploadResult>
  deleteBatch(keys: string[]): Promise<BatchDeleteResult>

  // Directory operations
  listFiles(prefix: string, limit?: number): Promise<FileList>
  copyFile(sourceKey: string, destKey: string): Promise<void>
  moveFile(sourceKey: string, destKey: string): Promise<void>
}
```

**Supported Providers:**
- AWS S3
- Google Cloud Storage
- Azure Blob Storage
- MinIO (S3-compatible)
- Local filesystem (development only)

**Storage Configuration:**

```json
{
  "provider": "string (s3|gcs|azure|minio|local)",
  "credentials": {
    "access_key": "string",
    "secret_key": "string",
    "bucket": "string",
    "region": "string (optional)"
  },
  "options": {
    "encryption": "boolean",
    "retention_days": "integer",
    "public_access": "boolean"
  }
}
```

### Queue/Job Processing Integration

**Message Format:**

```json
{
  "job_id": "uuid",
  "type": "string",
  "priority": "string (low|normal|high|critical)",
  "payload": "object",
  "retry_count": "integer",
  "created_at": "ISO-8601 timestamp",
  "expires_at": "ISO-8601 timestamp",
  "headers": {
    "idempotency_key": "string (optional)",
    "request_id": "string (optional)"
  }
}
```

**Supported Queues:**
- Redis (with Bull/BullMQ)
- RabbitMQ
- AWS SQS
- Google Cloud Tasks
- Local in-memory (development only)

---

## Error Handling

### Error Response Format

All errors return consistent JSON structure:

**Response (4xx/5xx):**
```json
{
  "error": {
    "code": "string (error code, e.g., INVALID_INPUT, FILE_TOO_LARGE)",
    "message": "string (human-readable message)",
    "details": {
      "field": "string (optional, for validation errors)",
      "value": "any (optional)",
      "constraint": "string (optional, validation rule that failed)"
    },
    "request_id": "uuid",
    "timestamp": "ISO-8601 timestamp"
  }
}
```

### HTTP Status Codes

| Status | Meaning | Typical Causes |
|--------|---------|-----------------|
| 400 | Bad Request | Invalid input, validation failure |
| 401 | Unauthorized | Missing/invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | State conflict (e.g., already processing) |
| 413 | Payload Too Large | File or request exceeds limits |
| 422 | Unprocessable Entity | Semantic validation failure |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unhandled server error |
| 502 | Bad Gateway | External service failure |
| 503 | Service Unavailable | Server overloaded or maintenance |

### Error Codes

**File Ingestion:**
- `FILE_NOT_PROVIDED`: No file in multipart request
- `FILE_TOO_LARGE`: Exceeds size limits
- `INVALID_CONTENT_TYPE`: Unsupported file type
- `CORRUPT_FILE`: File content validation failed
- `VIRUS_DETECTED`: Security scan flagged file

**Processing:**
- `PROCESSING_FAILED`: Content extraction failed
- `INVALID_DOCUMENT_STRUCTURE`: Malformed input
- `UNSUPPORTED_FORMAT`: File format not supported
- `RESOURCE_NOT_FOUND`: Referenced file/chunk not found

**AI Operations:**
- `AI_SERVICE_ERROR`: AI provider request failed
- `AI_RATE_LIMIT`: AI provider rate limit exceeded
- `EMBEDDING_FAILED`: Embedding generation failed
- `INSUFFICIENT_CONTEXT`: Not enough content for operation

**Learning:**
- `INVALID_LEARNING_STATE`: Incompatible operation for current state
- `PREREQUISITES_NOT_MET`: Prerequisites not completed
- `NO_CONTENT_AVAILABLE`: Insufficient content for path/lesson

**System:**
- `INTERNAL_ERROR`: Unexpected server error
- `SERVICE_UNAVAILABLE`: Service temporarily unavailable
- `DATABASE_ERROR`: Database operation failed
- `EXTERNAL_SERVICE_ERROR`: Third-party service failed

### Retry Policy

**Automatically Retried:**
- 502, 503, 504 (temporary service errors)
- Network timeouts
- Certain transient database errors

**Not Retried:**
- 400, 401, 403, 404, 409, 422 (client/semantic errors)
- 413 (payload size)

**Client-Side Retry Recommendations:**
```
For 429: Exponential backoff with jitter
For 5xx: Retry with exponential backoff, max 3 attempts
For timeouts: Retry once after 5s, then exponential backoff
```

---

## Validation Rules

### File Upload Validation

**Size Constraints:**
- Single file: ≤ 500 MB
- Batch total: ≤ 2 GB
- Minimum: ≥ 1 KB (prevents empty files)

**Content Type Whitelist:**
- Documents: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`, `text/markdown`
- Spreadsheets: `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Presentations: `application/vnd.ms-powerpoint`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`
- Archives: `application/zip` (for batch uploads)

**Filename Validation:**
- Length: 1-255 characters
- Allowed characters: alphanumeric, spaces, hyphens, underscores, periods
- Must not be empty after trim
- Must have extension matching content type

### Request Validation

**Authentication:**
- All endpoints except `/health` require `Authorization: Bearer <token>` header
- Token must be valid JWT or session token
- User must have appropriate permissions for resource

**Required Fields:**
- All fields marked `required` in schema must be present and non-empty
- Null values not allowed for required fields

**Type Validation:**
- Strings: must match type, max length per schema
- Numbers: must be within min/max range, appropriate precision
- Arrays: must contain valid elements, respect min/max length
- Objects: must be valid JSON, required nested fields present
- Dates: ISO-8601 format, must be reasonable (not far past/future)
- UUIDs: valid UUID v4 format

**Semantic Validation:**
- `user_id` must exist and be accessible to requesting user
- `course_id` must exist and requesting user must be enrolled
- `path_id` must belong to requesting user
- File references must point to existing files
- Chunk references must exist in referenced file
- Status transitions must follow state machine rules

### Content Processing Validation

**Chunk Bounds:**
- Minimum chunk size: 50 tokens
- Maximum chunk size: 2000 tokens
- Overlap (if configured): ≤ 30% of chunk size

**Metadata:**
- Complexity score: 0.0-1.0
- Reading time: 0-3600 seconds (0-1 hour per chunk)
- Language: valid ISO-639-1 code

**Learning Path Requirements:**
- Title: 1-200 characters
- Description: 0-2000 characters
- Learning objectives: 0-10 items, 10-200 chars each
- At least 1 learning objective recommended

### Query Validation

**Pagination:**
- Limit: 1-100 (default varies by endpoint)
- Offset: ≥ 0
- Default limit: 10-20 depending on endpoint

**Filtering:**
- Filter values must match enum/pattern defined in schema
- Multiple filters combined with AND logic
- Unknown filter keys are ignored (forward compatibility)

**Sorting:**
- Sort key must be in allowed fields list
- Direction: `asc` or `desc` (default: `asc`)

---

## Streaming

### File Upload Streaming

**Protocol:** HTTP multipart/form-data with chunked transfer encoding

**Chunk Size:** 1 MB recommended  
**Timeout:** 30 minutes for complete upload  
**Progress Reporting:** Client polls job progress endpoint

**Request Example:**
```
POST /api/v1/files/upload HTTP/1.1
Transfer-Encoding: chunked
Content-Type: multipart/form-data; boundary=---boundary

---boundary
Content-Disposition: form-data; name="file"; filename="large.pdf"
Content-Type: application/pdf

[binary data chunk 1]
[binary data chunk 2]
...
---boundary--
```

### Server-Sent Events (SSE) Streaming

**Protocol:** HTTP/1.1 with `Content-Type: text/event-stream`

**Used For:**
- Lesson Q&A responses (see `/lessons/{lesson_id}/ask`)
- Real-time progress updates
- Admin dashboards with live metrics

**Event Format:**
```
event: <event-type>
data: <json-data>
id: <event-id>
retry: <milliseconds>

```

**Example - Lesson Q&A Stream:**
```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

event: chunk
data: {"text": "This is a response "}
id: 1

event: chunk
data: {"text": "to your question."}
id: 2

event: references
data: {"references": [{"chunk_id": "...", "title": "..."}]}
id: 3

event: complete
data: {"interaction_id": "uuid", "total_tokens": 450}
id: 4

```

**Client Implementation Tips:**
- Use `EventSource` API (browser) or libraries like `eventsource` (Node.js)
- Handle reconnection with exponential backoff
- Set reasonable timeout (e.g., 5 minutes) for stream inactivity
- Parse JSON data within each event

### WebSocket Streaming (Optional, Future)

**For Real-Time Applications:**
- Live progress updates to multiple concurrent users
- Real-time collaboration features
- Future expansion path for interactive features

---

## Security & Authentication

### Authentication Methods

**Bearer Token (JWT)**
- Token format: `Authorization: Bearer <JWT>`
- Payload includes: `user_id`, `exp`, `iss`, `aud`, `permissions`
- Expiration: 1 hour (refresh token flow: 7 days)

**Example JWT Payload:**
```json
{
  "sub": "user_id",
  "user_id": "string",
  "email": "string",
  "permissions": ["read:files", "write:files", "read:paths", "write:paths"],
  "exp": 1234567890,
  "iat": 1234567890,
  "iss": "backend-api",
  "aud": "frontend-app"
}
```

### Authorization

**Permission Model:**
- Resource-based permissions (e.g., `read:files`, `write:paths`)
- Role-based access control (RBAC): admin, instructor, student
- User can only access their own data by default
- Instructors can access student data within their courses
- Admins have full access

### HTTPS

- **Required for all endpoints**
- Minimum TLS 1.2
- Valid certificate required

### Rate Limiting

**By User (Authenticated):**
- 1000 requests per hour (default)
- 100 concurrent requests
- Burst: 30 requests per minute

**By IP (Unauthenticated):**
- 100 requests per hour
- 10 concurrent requests
- Only `/health` endpoint allowed

**Response Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: <Unix timestamp>
```

**Rate Limit Exceeded Response (429):**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "details": {
      "retry_after_seconds": 60
    },
    "request_id": "uuid",
    "timestamp": "ISO-8601 timestamp"
  }
}
```

### CORS Policy

**Allowed Origins:**
- Configured per deployment environment
- Development: `http://localhost:3000`, `http://localhost:3001`
- Production: specific domain whitelist

**Allowed Methods:** GET, POST, PUT, DELETE, PATCH, OPTIONS  
**Allowed Headers:** Content-Type, Authorization, X-Request-ID  
**Exposed Headers:** X-RateLimit-*, X-API-Version, X-Request-ID

### Data Protection

**At Rest:**
- AES-256 encryption for sensitive fields (API keys, passwords)
- Database encryption (transparent via storage provider)

**In Transit:**
- TLS 1.2+ for all connections
- Certificate pinning for mobile clients (optional)

**Sensitive Fields:**
- User passwords (hashed with bcrypt, min cost factor 12)
- API credentials (never returned in responses)
- Personal information: PII classification per GDPR/CCPA

### Audit Logging

**Logged Events:**
- File uploads/deletions
- Content processing operations
- User authentication/authorization
- API key generation/revocation
- Configuration changes (admin only)

**Log Retention:** 90 days minimum  
**Log Format:**
```json
{
  "timestamp": "ISO-8601",
  "event_type": "string",
  "user_id": "string",
  "resource_id": "uuid",
  "action": "string",
  "result": "string (success|failure)",
  "request_id": "uuid",
  "details": "object"
}
```

---

## Implementation Guidelines

### Request/Response Pattern

All endpoints should follow this pattern:

**Request:**
- Headers: `Content-Type: application/json`, `Authorization: Bearer <token>`
- Body: JSON object matching schema
- Query parameters for filtering/pagination

**Response Success (2xx):**
```json
{
  "status": "success",
  "data": { /* response object */ },
  "meta": {
    "request_id": "uuid",
    "timestamp": "ISO-8601 timestamp"
  }
}
```

**Response Error (4xx/5xx):**
```json
{
  "status": "error",
  "error": { /* error object */ }
}
```

### Idempotency

**Idempotent Operations:**
- GET, HEAD, OPTIONS, PUT (when implemented), DELETE (with caveats)
- File upload: use `Idempotency-Key: <UUID>` header
- Key format: UUID v4, must be stable across retries
- Retention: 24 hours minimum

**Request Header:**
```
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

### Request ID Tracing

**Header:** `X-Request-ID: <UUID>`
- Generated by client or server
- Included in all responses
- Used for debugging and correlation
- Passed to external service calls

### Pagination Pattern

**Request:**
```
GET /api/v1/lessons?limit=20&offset=0&sort=-created_at
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total_count": 150,
    "has_more": true,
    "next_url": "/api/v1/lessons?limit=20&offset=20"
  }
}
```

---

## Testing Scenarios

To validate this spec, the following scenarios should be testable:

1. **File Upload**: Upload a file, verify metadata extraction, check chunking
2. **Content Processing**: Retrieve processed content structure with embeddings
3. **Learning Path**: Create path, generate lessons, complete lessons, track progress
4. **Search**: Query similar content using semantic search
5. **Error Handling**: Attempt invalid operations, verify error responses
6. **Rate Limiting**: Exceed rate limits, verify 429 response
7. **Async Jobs**: Submit long-running task, poll completion
8. **Streaming**: Ask question during lesson, receive streamed response

---

## Appendix: Example Workflows

### Workflow 1: Upload and Process a Course Document

```
1. POST /api/v1/files/upload
   → Returns file_id and job_id

2. Poll GET /api/v1/jobs/{job_id} until COMPLETED

3. GET /api/v1/content/{file_id}
   → Verify sections, chunks extracted

4. POST /api/v1/content/{file_id}/chunks/{chunk_id}/embed
   → Queue embedding generation

5. Poll GET /api/v1/jobs/{embedding_job_id}

6. GET /api/v1/content/{file_id}/chunks/{chunk_id}?include_embedding=true
   → Retrieve chunk with embeddings
```

### Workflow 2: Create and Complete Learning Path

```
1. POST /api/v1/learning-paths
   → Returns path_id

2. POST /api/v1/learning-paths/{path_id}/lessons
   → Returns generation_job_id

3. Poll GET /api/v1/jobs/{generation_job_id}

4. GET /api/v1/learning-paths/{path_id}
   → See generated lessons

5. For each lesson:
   a. Review content via GET /api/v1/content/{file_id}/chunks/{chunk_id}
   b. Ask questions via POST /api/v1/lessons/{lesson_id}/ask (streaming)
   c. Complete with POST /api/v1/lessons/{lesson_id}/complete

6. GET /api/v1/users/{user_id}/progress
   → Verify completion and metrics
```

### Workflow 3: Search and Discover Content

```
1. POST /api/v1/content/search
   → Query: "explain machine learning"
   → Returns similar chunks with scores

2. GET /api/v1/content/{file_id}
   → Review full content around relevant chunk

3. POST /api/v1/learning-paths/{path_id}/lessons
   → Include discovered content in focus_areas
```

---

## Conclusion

This specification provides sufficient detail to:
- Begin implementation of backend services
- Generate OpenAPI/Swagger documentation
- Design database schemas
- Plan integration points
- Establish testing frameworks
- Guide frontend development

**Next Steps:**
1. Generate OpenAPI 3.0 spec from this document
2. Create database schema based on resource models
3. Implement service layer for each module
4. Set up integration tests
5. Document deployment and scaling strategies
