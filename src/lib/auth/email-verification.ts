import "server-only";

import { createHash, randomBytes } from "node:crypto";

export function createEmailVerificationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashEmailVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getEmailVerificationExpiresAt() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}
