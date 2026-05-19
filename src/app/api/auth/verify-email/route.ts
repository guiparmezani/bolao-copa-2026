import { NextRequest, NextResponse } from "next/server";

import { getRequestOrigin } from "@/lib/auth/http";
import { hashEmailVerificationToken } from "@/lib/auth/email-verification";
import { prisma } from "@/lib/prisma";

function redirectWithMessage(request: NextRequest, key: "erro" | "mensagem", message: string) {
  const url = new URL("/login", getRequestOrigin(request));
  url.searchParams.set(key, message);
  return NextResponse.redirect(url, { status: 303 });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return redirectWithMessage(request, "erro", "Link de confirmação inválido.");
  }

  const tokenHash = hashEmailVerificationToken(token);
  const user = await prisma.user.findFirst({
    where: {
      emailVerificationTokenExpiresAt: {
        gt: new Date(),
      },
      emailVerificationTokenHash: tokenHash,
    },
  });

  if (!user) {
    return redirectWithMessage(request, "erro", "Link de confirmação inválido ou expirado.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerificationTokenExpiresAt: null,
      emailVerificationTokenHash: null,
    },
  });

  return redirectWithMessage(request, "mensagem", "Email confirmado com sucesso.");
}
