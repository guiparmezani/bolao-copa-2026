CREATE TABLE "provider_sync_logs" (
    "id" UUID NOT NULL,
    "provider_source" TEXT NOT NULL,
    "sync_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "error_message" TEXT,
    "metadata" JSONB,

    CONSTRAINT "provider_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "provider_sync_logs_provider_source_sync_type_started_at_idx" ON "provider_sync_logs"("provider_source", "sync_type", "started_at");
CREATE INDEX "provider_sync_logs_status_started_at_idx" ON "provider_sync_logs"("status", "started_at");
