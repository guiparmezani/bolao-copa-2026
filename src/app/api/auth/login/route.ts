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
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { validateUsername } from "@/lib/auth/username";
import { prisma } from "@/lib/prisma";

const INVALID_LOGIN = "Usuário ou senha inválidos.";

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) {
    return formError("Requisição inválida.", 403);
  }

  const formData = await request.formData();
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const usernameValidation = validateUsername(username);
  const normalized = usernameValidation.ok ? usernameValidation.normalized : null;
  const ipAddress = getRequestIp(request);

  if (await isRateLimited("login", normalized, ipAddress)) {
    await recordAuthAttempt("login", "rate_limited", normalized, ipAddress);
    return redirectWithError(
      request,
      "/login",
      "Muitas tentativas. Espere alguns minutos e tente de novo.",
    );
  }

  if (!usernameValidation.ok || !password) {
    await recordAuthAttempt("login", "invalid", normalized, ipAddress);
    return redirectWithError(request, "/login", INVALID_LOGIN);
  }

  const user = await prisma.user.findUnique({
    where: { usernameNormalized: usernameValidation.normalized },
  });

  if (
    !user ||
    user.status !== "active" ||
    !(await verifyPassword(user.passwordHash, password))
  ) {
    await recordAuthAttempt(
      "login",
      "invalid",
      usernameValidation.normalized,
      ipAddress,
    );
    return redirectWithError(request, "/login", INVALID_LOGIN);
  }

  await recordAuthAttempt(
    "login",
    "success",
    usernameValidation.normalized,
    ipAddress,
  );
  await createSession(user.id);

  return redirectTo(request, "/dashboard");
}
