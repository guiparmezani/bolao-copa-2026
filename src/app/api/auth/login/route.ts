import { NextRequest } from "next/server";
import {
  formError,
  getRequestIp,
  isRateLimited,
  recordAuthAttempt,
  redirectTo,
  redirectWithError,
  requireSameOrigin,
} from "@/lib/auth/http";
import { validateEmail } from "@/lib/auth/email-address";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { normalizeUsername } from "@/lib/auth/username";
import { prisma } from "@/lib/prisma";

const INVALID_LOGIN = "Email ou senha inválidos.";

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) {
    return formError("Requisição inválida.", 403);
  }

  const formData = await request.formData();
  const identifier = String(formData.get("email") ?? formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const emailValidation = validateEmail(identifier);
  const legacyUsername = normalizeUsername(identifier);
  const normalized = emailValidation.ok
    ? emailValidation.normalized
    : legacyUsername || null;
  const ipAddress = getRequestIp(request);

  if (await isRateLimited("login", normalized, ipAddress)) {
    await recordAuthAttempt("login", "rate_limited", normalized, ipAddress);
    return redirectWithError(
      request,
      "/login",
      "Muitas tentativas. Espere alguns minutos e tente de novo.",
    );
  }

  if (!identifier || !password) {
    await recordAuthAttempt("login", "invalid", normalized, ipAddress);
    return redirectWithError(request, "/login", INVALID_LOGIN);
  }

  const user = emailValidation.ok
    ? await prisma.user.findUnique({
        where: { emailNormalized: emailValidation.normalized },
      })
    : await prisma.user.findUnique({
        where: { usernameNormalized: legacyUsername },
      });

  if (
    !user ||
    user.status !== "active" ||
    !(await verifyPassword(user.passwordHash, password))
  ) {
    await recordAuthAttempt(
      "login",
      "invalid",
      normalized,
      ipAddress,
    );
    return redirectWithError(request, "/login", INVALID_LOGIN);
  }

  await recordAuthAttempt(
    "login",
    "success",
    normalized,
    ipAddress,
  );
  await createSession(user.id);

  return redirectTo(request, user.role === "admin" ? "/admin" : "/dashboard");
}
