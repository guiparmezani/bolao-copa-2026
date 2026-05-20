import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateEmail } from "@/lib/auth/email-address";
import {
  createEmailVerificationToken,
  getEmailVerificationExpiresAt,
  hashEmailVerificationToken,
} from "@/lib/auth/email-verification";
import {
  formError,
  getRequestIp,
  getRequestOrigin,
  isRateLimited,
  recordAuthAttempt,
  redirectTo,
  redirectWithError,
  requireSameOrigin,
} from "@/lib/auth/http";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { sendAccountVerificationEmail } from "@/lib/email/messages";

function wantsJson(request: NextRequest) {
  return request.headers.get("accept")?.includes("application/json") ?? false;
}

function signupError(request: NextRequest, message: string, status = 400) {
  if (wantsJson(request)) {
    return Response.json({ error: message }, { status });
  }

  return redirectWithError(request, "/signup", message);
}

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) {
    return formError("Requisição inválida.", 403);
  }

  const formData = await request.formData();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(
    formData.get("passwordConfirmation") ?? "",
  );
  const emailValidation = validateEmail(email);
  const normalized = emailValidation.ok ? emailValidation.normalized : null;
  const ipAddress = getRequestIp(request);

  if (await isRateLimited("signup", normalized, ipAddress)) {
    await recordAuthAttempt("signup", "rate_limited", normalized, ipAddress);
    return signupError(
      request,
      "Muitas tentativas. Espere alguns minutos e tente de novo.",
      429,
    );
  }

  if (!displayName || displayName.length > 80) {
    await recordAuthAttempt("signup", "invalid", normalized, ipAddress);
    return signupError(
      request,
      "Informe um nome de exibição com até 80 caracteres.",
    );
  }

  if (!emailValidation.ok) {
    await recordAuthAttempt("signup", "invalid", normalized, ipAddress);
    return signupError(request, emailValidation.error);
  }

  const passwordError = validatePassword(password);

  if (passwordError) {
    await recordAuthAttempt("signup", "invalid", normalized, ipAddress);
    return signupError(request, passwordError);
  }

  if (password !== passwordConfirmation) {
    await recordAuthAttempt("signup", "invalid", normalized, ipAddress);
    return signupError(request, "As senhas não conferem.");
  }

  try {
    const verificationToken = createEmailVerificationToken();
    const user = await prisma.user.create({
      data: {
        displayName,
        email: emailValidation.normalized,
        emailNormalized: emailValidation.normalized,
        emailVerificationTokenExpiresAt: getEmailVerificationExpiresAt(),
        emailVerificationTokenHash: hashEmailVerificationToken(verificationToken),
        username: emailValidation.normalized,
        usernameNormalized: emailValidation.normalized,
        passwordHash: await hashPassword(password),
      },
    });

    await recordAuthAttempt("signup", "success", normalized, ipAddress);
    await sendAccountVerificationEmail({
      displayName: user.displayName,
      to: emailValidation.normalized,
      verificationUrl: `${getRequestOrigin(request)}/api/auth/verify-email?token=${verificationToken}`,
    }).catch((emailError) => {
      console.error("Failed to send account verification email", emailError);
    });
    await createSession(user.id);

    if (wantsJson(request)) {
      return Response.json({ redirectTo: "/dashboard" });
    }

    return redirectTo(request, "/dashboard");
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      await recordAuthAttempt("signup", "invalid", normalized, ipAddress);
      return signupError(
        request,
        "Esse email já está em uso.",
        409,
      );
    }

    throw error;
  }
}
