ALTER TABLE "users"
ADD COLUMN "avatar_image_data_url" TEXT,
ADD COLUMN "avatar_image_mime_type" TEXT,
ADD COLUMN "avatar_image_updated_at" TIMESTAMP(3);
