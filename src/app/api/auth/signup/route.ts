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
import { validateUsername } from "@/lib/auth/username";
import { sendAccountVerificationEmail } from "@/lib/email/messages";

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) {
    return formError("Requisição inválida.", 403);
  }

  const formData = await request.formData();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "");
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(
    formData.get("passwordConfirmation") ?? "",
  );
  const emailValidation = validateEmail(email);
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

  if (!emailValidation.ok) {
    await recordAuthAttempt("signup", "invalid", normalized, ipAddress);
    return redirectWithError(request, "/signup", emailValidation.error);
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
    const verificationToken = createEmailVerificationToken();
    const user = await prisma.user.create({
      data: {
        displayName,
        email: emailValidation.normalized,
        emailNormalized: emailValidation.normalized,
        emailVerificationTokenExpiresAt: getEmailVerificationExpiresAt(),
        emailVerificationTokenHash: hashEmailVerificationToken(verificationToken),
        username: usernameValidation.normalized,
        usernameNormalized: usernameValidation.normalized,
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
        "Esse nome de usuário ou email já está em uso.",
      );
    }

    throw error;
  }
}
