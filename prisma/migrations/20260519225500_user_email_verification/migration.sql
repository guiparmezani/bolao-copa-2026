ALTER TABLE "users"
ADD COLUMN "email" TEXT,
ADD COLUMN "email_normalized" TEXT,
ADD COLUMN "email_verified_at" TIMESTAMP(3),
ADD COLUMN "email_verification_token_hash" TEXT,
ADD COLUMN "email_verification_token_expires_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_email_normalized_key" ON "users"("email_normalized");
CREATE UNIQUE INDEX "users_email_verification_token_hash_key" ON "users"("email_verification_token_hash");
