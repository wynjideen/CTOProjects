# File Ingestion Service

This document provides an overview of the file ingestion service implementation and how to use it.

## Overview

The file ingestion service provides a comprehensive solution for uploading, storing, and managing files with the following features:

- **Streaming Uploads**: Support for large files up to 500MB (single) and 2GB (batch)
- **S3 Storage**: Files are stored in AWS S3 with metadata tagging
- **Database Integration**: File metadata stored in PostgreSQL via Prisma ORM
- **Job Queue**: Background processing for content analysis and virus scanning
- **WebSocket Events**: Real-time progress updates for clients
- **Validation**: Comprehensive file type, size, and security validation

## API Endpoints

### Single File Upload
```
POST /api/v1/files/upload
Content-Type: multipart/form-data

Parameters:
- file: Binary file data
- user_id: string (required)
- course_id: string (optional)
- document_type: string (optional)
- tags: string[] (optional)
- description: string (optional)
```

### Batch File Upload
```
POST /api/v1/files/batch-upload
Content-Type: multipart/form-data

Parameters:
- files: Binary file data (up to 10 files)
- user_id: string (required)
- course_id: string (optional)
- document_type: string (optional)
- tags: string[] (optional)
- description: string (optional)
```

### Get File Metadata
```
GET /api/v1/files/{fileId}
Headers: x-user-id: {userId}
```

### Delete File
```
DELETE /api/v1/files/{fileId}
Headers: x-user-id: {userId}
```

### List User Files
```
GET /api/v1/files?limit=20&offset=0&document_type=lecture
Headers: x-user-id: {userId}
```

## WebSocket Events

Connect to `ws://localhost:3000/ws` to receive real-time events:

### Upload Progress
```json
{
  "type": "upload:progress",
  "data": {
    "fileId": "uuid",
    "userId": "uuid", 
    "progress": 45,
    "bytesUploaded": 1024000
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "eventId": "event_uuid"
}
```

### Upload Complete
```json
{
  "type": "upload:complete",
  "data": {
    "fileId": "uuid",
    "userId": "uuid",
    "file": { /* file metadata */ }
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "eventId": "event_uuid"
}
```

### Upload Error
```json
{
  "type": "upload:error",
  "data": {
    "fileId": "uuid",
    "userId": "uuid",
    "error": "File type not supported"
  },
  "timestamp": "2024-01-01T00:00:00.000Z",
  "eventId": "event_uuid"
}
```

## Configuration

The service uses the following configuration options in your `.env` file:

```env
# File Upload Limits
MAX_FILE_SIZE=524288000  # 500MB in bytes
MAX_BATCH_SIZE=2147483648  # 2GB in bytes

# Allowed MIME types (comma-separated)
ALLOWED_MIME_TYPES=application/pdf,text/plain,image/jpeg,image/png

# Feature Flags
ENABLE_VIRUS_SCANNING=false
ENABLE_WEBSOCKET_EVENTS=true
```

## Usage Examples

### Upload a file with curl:
```bash
curl -X POST http://localhost:3000/api/v1/files/upload \
  -F "file=@document.pdf" \
  -F "user_id=user-123" \
  -F "document_type=lecture" \
  -F "tags=math,calculus" \
  -F "description=Chapter 5 notes"
```

### Upload multiple files:
```bash
curl -X POST http://localhost:3000/api/v1/files/batch-upload \
  -F "files=@doc1.pdf" \
  -F "files=@doc2.pdf" \
  -F "files=@doc3.pdf" \
  -F "user_id=user-123" \
  -F "document_type=lecture"
```

### Get file metadata:
```bash
curl -X GET http://localhost:3000/api/v1/files/{fileId} \
  -H "x-user-id: user-123"
```

### Delete a file:
```bash
curl -X DELETE http://localhost:3000/api/v1/files/{fileId} \
  -H "x-user-id: user-123"
```

## Error Handling

The service provides detailed error responses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "File validation failed: File size exceeds maximum allowed size",
    "details": {
      "field": "file",
      "issue": "size_limit_exceeded"
    }
  }
}
```

Common error codes:
- `VALIDATION_ERROR`: Input validation failed
- `STORAGE_ERROR`: S3 upload failed
- `DATABASE_ERROR`: Database operation failed
- `NOT_FOUND`: File not found
- `FORBIDDEN`: Access denied
- `UPLOAD_ERROR`: General upload failure

## Testing

Run the test suite:
```bash
npm test
```

Run specific integration tests:
```bash
npm test -- src/integration-tests/file-ingestion.test.ts
```

## Architecture

The file ingestion service follows a layered architecture:

1. **Routes**: Express.js route handlers with validation
2. **Services**: Business logic (FileIngestionService, S3StorageService, etc.)
3. **Database**: PostgreSQL via Prisma ORM
4. **Queue**: Bull with Redis for background jobs
5. **Storage**: AWS S3 for file persistence
6. **Events**: WebSocket for real-time updates

## Security Features

- **File Type Validation**: Only allowed MIME types accepted
- **Size Limits**: Configurable size limits prevent abuse
- **Filename Sanitization**: Prevents path traversal attacks
- **Access Control**: User-scoped file access
- **Metadata Tagging**: S3 object tagging for organization
- **Virus Scanning**: Hook for optional security scanning

## Performance Considerations

- **Streaming**: Memory-efficient file processing
- **Concurrency**: Parallel batch upload processing
- **Connection Pooling**: Reused database and S3 connections
- **Background Jobs**: Non-blocking content processing
- **Caching**: Redis for job queue management

## Monitoring

The service includes comprehensive logging and metrics:

- Structured JSON logging with Pino
- Request correlation IDs
- Job queue statistics
- WebSocket connection metrics
- Error tracking and alerting

## Development

Start the development server:
```bash
npm run dev
```

The server will start on port 3000 with WebSocket support at `/ws`.

## Production Deployment

1. Set environment variables for production
2. Configure S3 bucket and permissions
3. Set up Redis for job queue
4. Configure PostgreSQL connection
5. Set up monitoring and logging

## License

This implementation is part of the CTOProjects learning platform.