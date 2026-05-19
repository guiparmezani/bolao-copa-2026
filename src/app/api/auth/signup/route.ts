import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  formError,
  getRequestIp,
  isRateLimited,
  recordAuthAttempt,
  redirectTo,
  redirectWithError,
  requireSameOrigin,
} from "@/lib/auth/http";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { validateUsername } from "@/lib/auth/username";

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) {
    return formError("Requisição inválida.", 403);
  }

  const formData = await request.formData();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(
    formData.get("passwordConfirmation") ?? "",
  );
  const usernameValidation = validateUsername(username);
  const normalized = usernameValidation.ok ? usernameValidation.normalized : null;
  const ipAddress = getRequestIp(request);

  if (await isRateLimited("signup", normalized, ipAddress)) {
    await recordAuthAttempt("signup", "rate_limited", normalized, ipAddress);
    return redirectWithError(
      request,
      "/signup",
      "Muitas tentativas. Espere alguns minutos e tente de novo.",
    );
  }

  if (!displayName || displayName.length > 80) {
    await recordAuthAttempt("signup", "invalid", normalized, ipAddress);
    return redirectWithError(
      request,
      "/signup",
      "Informe um nome de exibição com até 80 caracteres.",
    );
  }

  if (!usernameValidation.ok) {
    await recordAuthAttempt("signup", "invalid", normalized, ipAddress);
    return redirectWithError(request, "/signup", usernameValidation.error);
  }

  const passwordError = validatePassword(password);

  if (passwordError) {
    await recordAuthAttempt("signup", "invalid", normalized, ipAddress);
    return redirectWithError(request, "/signup", passwordError);
  }

  if (password !== passwordConfirmation) {
    await recordAuthAttempt("signup", "invalid", normalized, ipAddress);
    return redirectWithError(request, "/signup", "As senhas não conferem.");
  }

  try {
    const user = await prisma.user.create({
      data: {
        displayName,
        username: usernameValidation.normalized,
        usernameNormalized: usernameValidation.normalized,
        passwordHash: await hashPassword(password),
      },
    });

    await recordAuthAttempt("signup", "success", normalized, ipAddress);
    await createSession(user.id);

    return redirectTo(request, "/dashboard");
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      await recordAuthAttempt("signup", "invalid", normalized, ipAddress);
      return redirectWithError(
        request,
        "/signup",
        "Esse nome de usuário já está em uso.",
      );
    }

    throw error;
  }
}
