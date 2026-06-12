import { NextRequest } from "next/server";

import { redirectWithError, requireSameOrigin } from "@/lib/auth/http";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { hashPasswordResetToken } from "@/lib/auth/password-reset";
import { prisma } from "@/lib/prisma";

function wantsJson(request: NextRequest) {
  return request.headers.get("accept")?.includes("application/json") ?? false;
}

function resetError(request: NextRequest, token: string, message: string, status = 400) {
  if (wantsJson(request)) {
    return Response.json({ error: message }, { status });
  }

  const path = token
    ? `/reset-password?token=${encodeURIComponent(token)}`
    : "/reset-password";

  return redirectWithError(request, path, message);
}

function resetSuccess(request: NextRequest) {
  const path = "/login?mensagem=Senha redefinida. Entre com sua nova senha.";

  if (wantsJson(request)) {
    return Response.json({ redirectTo: path });
  }

  return Response.redirect(new URL(path, request.url), 303);
}

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) {
    return Response.json({ error: "Requisição inválida." }, { status: 403 });
  }

  const formData = await request.formData();
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(formData.get("passwordConfirmation") ?? "");
  const invalidLinkMessage =
    "Link de redefinição inválido ou expirado. Peça um novo link ao administrador.";

  if (!token) {
    return resetError(request, token, invalidLinkMessage);
  }

  const passwordError = validatePassword(password);

  if (passwordError) {
    return resetError(request, token, passwordError);
  }

  if (password !== passwordConfirmation) {
    return resetError(request, token, "As senhas não conferem.");
  }

  const user = await prisma.user.findFirst({
    where: {
      passwordResetTokenExpiresAt: {
        gt: new Date(),
      },
      passwordResetTokenHash: hashPasswordResetToken(token),
      status: "active",
    },
    select: {
      id: true,
      email: true,
    },
  });

  if (!user) {
    return resetError(request, token, invalidLinkMessage);
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenExpiresAt: null,
        passwordResetTokenHash: null,
      },
    }),
    prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now },
    }),
    prisma.auditLog.create({
      data: {
        action: "user.password_reset_complete",
        actorUserId: user.id,
        afterPayload: { email: user.email, sessionsRevoked: true },
        targetEntity: "user",
        targetId: user.id,
      },
    }),
  ]);

  return resetSuccess(request);
}
