-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('LEARNER', 'ADMIN');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "profile_picture_url" VARCHAR(500),
    "preferences" JSONB,
    "role" "UserRole" NOT NULL DEFAULT 'LEARNER',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_materials" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "source_url" VARCHAR(1000),
    "source_type" VARCHAR(50) NOT NULL,
    "metadata" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'processing',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "content_length" INTEGER,
    "difficulty_level" VARCHAR(20),
    "subject_area" VARCHAR(100),
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "study_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_chunks" (
    "id" UUID NOT NULL,
    "study_material_id" UUID NOT NULL,
    "chunk_order" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "chunk_type" VARCHAR(50) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "word_count" INTEGER,
    "language" VARCHAR(10),
    "summary" TEXT,
    "relevance_score" DOUBLE PRECISION,

    CONSTRAINT "content_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_assets" (
    "id" UUID NOT NULL,
    "study_material_id" UUID NOT NULL,
    "content_chunk_id" UUID,
    "asset_type" VARCHAR(50) NOT NULL,
    "content" JSONB NOT NULL,
    "metadata" JSONB,
    "generation_model" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ready',
    "quality_score" DOUBLE PRECISION,
    "difficulty_level" INTEGER,
    "generation_params" JSONB,

    CONSTRAINT "generated_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "study_material_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),
    "session_type" VARCHAR(50) NOT NULL,
    "session_data" JSONB,
    "total_interactions" INTEGER NOT NULL DEFAULT 0,
    "completion_percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "configuration" JSONB,

    CONSTRAINT "learning_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Partition hint: interactions data grows quickly; range partition by created_at (monthly) for faster retention purges.
CREATE TABLE "interactions" (
    "id" UUID NOT NULL,
    "learning_session_id" UUID NOT NULL,
    "generated_asset_id" UUID,
    "user_id" UUID NOT NULL,
    "interaction_type" VARCHAR(50) NOT NULL,
    "interaction_data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_correct" BOOLEAN,
    "response_time_ms" INTEGER,
    "confidence_level" DOUBLE PRECISION,
    "feedback_data" JSONB,

    CONSTRAINT "interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_feedback" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "generated_asset_id" UUID,
    "interaction_id" UUID,
    "feedback_type" VARCHAR(50) NOT NULL,
    "rating" SMALLINT,
    "comment" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',

    CONSTRAINT "user_feedback_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_rating_range" CHECK ("rating" IS NULL OR ("rating" BETWEEN 1 AND 5));

-- CreateTable
-- Partition hint: progress metrics benefit from RANGE partitioning on recorded_at to keep rolling windows efficient.
CREATE TABLE "progress_metrics" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "learning_session_id" UUID,
    "metric_type" VARCHAR(50) NOT NULL,
    "metric_value" DOUBLE PRECISION NOT NULL,
    "metric_data" JSONB,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "time_period" VARCHAR(20),
    "subject_area" VARCHAR(100),
    "aggregation_type" VARCHAR(20),

    CONSTRAINT "progress_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- Partition hint: audit logs should be RANGE partitioned by created_at (monthly) to align with retention policies.
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "session_id" VARCHAR(255),
    "is_success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "idx_users_username" ON "users"("username");

-- CreateIndex
CREATE INDEX "idx_users_created_at" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "idx_users_is_active_deleted_at" ON "users"("is_active", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_study_materials_user_id" ON "study_materials"("user_id");

-- CreateIndex
CREATE INDEX "idx_study_materials_status" ON "study_materials"("status");

-- CreateIndex
CREATE INDEX "idx_study_materials_created_at" ON "study_materials"("created_at");

-- CreateIndex
CREATE INDEX "idx_study_materials_subject_area" ON "study_materials"("subject_area");

-- CreateIndex
CREATE INDEX "idx_study_materials_tags" ON "study_materials" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "idx_study_materials_deleted_at" ON "study_materials"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_content_chunks_study_material_id" ON "content_chunks"("study_material_id");

-- CreateIndex
CREATE INDEX "idx_content_chunks_chunk_order" ON "content_chunks"("study_material_id", "chunk_order");

-- CreateIndex
CREATE INDEX "idx_content_chunks_chunk_type" ON "content_chunks"("chunk_type");

-- CreateIndex
CREATE INDEX "idx_content_chunks_relevance_score" ON "content_chunks"("relevance_score");

-- CreateIndex
CREATE INDEX "idx_content_chunks_language" ON "content_chunks"("language");

-- CreateIndex
CREATE INDEX "idx_generated_assets_study_material_id" ON "generated_assets"("study_material_id");

-- CreateIndex
CREATE INDEX "idx_generated_assets_content_chunk_id" ON "generated_assets"("content_chunk_id");

-- CreateIndex
CREATE INDEX "idx_generated_assets_asset_type" ON "generated_assets"("asset_type");

-- CreateIndex
CREATE INDEX "idx_generated_assets_status" ON "generated_assets"("status");

-- CreateIndex
CREATE INDEX "idx_generated_assets_quality_score" ON "generated_assets"("quality_score");

-- CreateIndex
CREATE INDEX "idx_generated_assets_difficulty_level" ON "generated_assets"("difficulty_level");

-- CreateIndex
CREATE INDEX "idx_generated_assets_created_at" ON "generated_assets"("created_at");

-- CreateIndex
CREATE INDEX "idx_learning_sessions_user_id" ON "learning_sessions"("user_id");

-- CreateIndex
CREATE INDEX "idx_learning_sessions_study_material_id" ON "learning_sessions"("study_material_id");

-- CreateIndex
CREATE INDEX "idx_learning_sessions_started_at" ON "learning_sessions"("started_at");

-- CreateIndex
CREATE INDEX "idx_learning_sessions_status" ON "learning_sessions"("status");

-- CreateIndex
CREATE INDEX "idx_learning_sessions_session_type" ON "learning_sessions"("session_type");

-- CreateIndex
CREATE INDEX "idx_learning_sessions_completion_percentage" ON "learning_sessions"("completion_percentage");

-- CreateIndex
CREATE INDEX "idx_interactions_learning_session_id" ON "interactions"("learning_session_id");

-- CreateIndex
CREATE INDEX "idx_interactions_generated_asset_id" ON "interactions"("generated_asset_id");

-- CreateIndex
CREATE INDEX "idx_interactions_user_id" ON "interactions"("user_id");

-- CreateIndex
CREATE INDEX "idx_interactions_created_at" ON "interactions"("created_at");
-- Cluster hint: CLUSTER "interactions" USING "idx_interactions_created_at" periodically to keep append-only storage ordered.

-- CreateIndex
CREATE INDEX "idx_interactions_interaction_type" ON "interactions"("interaction_type");

-- CreateIndex
CREATE INDEX "idx_interactions_is_correct" ON "interactions"("is_correct");

-- CreateIndex
CREATE INDEX "idx_user_feedback_user_id" ON "user_feedback"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_feedback_generated_asset_id" ON "user_feedback"("generated_asset_id");

-- CreateIndex
CREATE INDEX "idx_user_feedback_interaction_id" ON "user_feedback"("interaction_id");

-- CreateIndex
CREATE INDEX "idx_user_feedback_feedback_type" ON "user_feedback"("feedback_type");

-- CreateIndex
CREATE INDEX "idx_user_feedback_rating" ON "user_feedback"("rating");

-- CreateIndex
CREATE INDEX "idx_user_feedback_created_at" ON "user_feedback"("created_at");

-- CreateIndex
CREATE INDEX "idx_progress_metrics_user_id" ON "progress_metrics"("user_id");

-- CreateIndex
CREATE INDEX "idx_progress_metrics_learning_session_id" ON "progress_metrics"("learning_session_id");

-- CreateIndex
CREATE INDEX "idx_progress_metrics_metric_type" ON "progress_metrics"("metric_type");

-- CreateIndex
CREATE INDEX "idx_progress_metrics_recorded_at" ON "progress_metrics"("recorded_at");
-- Cluster hint: CLUSTER "progress_metrics" USING "idx_progress_metrics_recorded_at" to optimize time-series reads.

-- CreateIndex
CREATE INDEX "idx_progress_metrics_time_period" ON "progress_metrics"("time_period");

-- CreateIndex
CREATE INDEX "idx_progress_metrics_subject_area" ON "progress_metrics"("subject_area");

-- CreateIndex
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_action" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "idx_audit_logs_entity_type" ON "audit_logs"("entity_type");

-- CreateIndex
CREATE INDEX "idx_audit_logs_entity_id" ON "audit_logs"("entity_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs"("created_at");
-- Cluster hint: CLUSTER "audit_logs" USING "idx_audit_logs_created_at" after large backfills for faster chronological scans.

-- CreateIndex
CREATE INDEX "idx_audit_logs_is_success" ON "audit_logs"("is_success");

-- CreateIndex
CREATE INDEX "idx_audit_logs_session_id" ON "audit_logs"("session_id");

-- AddForeignKey
ALTER TABLE "study_materials" ADD CONSTRAINT "study_materials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_chunks" ADD CONSTRAINT "content_chunks_study_material_id_fkey" FOREIGN KEY ("study_material_id") REFERENCES "study_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_assets" ADD CONSTRAINT "generated_assets_study_material_id_fkey" FOREIGN KEY ("study_material_id") REFERENCES "study_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_assets" ADD CONSTRAINT "generated_assets_content_chunk_id_fkey" FOREIGN KEY ("content_chunk_id") REFERENCES "content_chunks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_study_material_id_fkey" FOREIGN KEY ("study_material_id") REFERENCES "study_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_learning_session_id_fkey" FOREIGN KEY ("learning_session_id") REFERENCES "learning_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_generated_asset_id_fkey" FOREIGN KEY ("generated_asset_id") REFERENCES "generated_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_generated_asset_id_fkey" FOREIGN KEY ("generated_asset_id") REFERENCES "generated_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "interactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_metrics" ADD CONSTRAINT "progress_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_metrics" ADD CONSTRAINT "progress_metrics_learning_session_id_fkey" FOREIGN KEY ("learning_session_id") REFERENCES "learning_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

