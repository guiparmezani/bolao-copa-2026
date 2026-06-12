import { NextRequest } from "next/server";

import { validateAvatarDataUrl } from "@/lib/avatar";
import { formError, requireSameOrigin } from "@/lib/auth/http";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) {
    return formError("Requisição inválida.", 403);
  }

  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Faça login para alterar seu avatar." }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return formError("Envie uma imagem válida.");
  }

  const avatarDataUrl = body && typeof body === "object" && "avatarDataUrl" in body
    ? (body as { avatarDataUrl: unknown }).avatarDataUrl
    : undefined;
  const validation = validateAvatarDataUrl(avatarDataUrl);

  if (!validation.ok) {
    return formError(validation.error);
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: validation.value
      ? {
          avatarImageDataUrl: validation.value.dataUrl,
          avatarImageMimeType: validation.value.mimeType,
          avatarImageUpdatedAt: new Date(),
        }
      : {
          avatarImageDataUrl: null,
          avatarImageMimeType: null,
          avatarImageUpdatedAt: null,
        },
    select: {
      avatarImageDataUrl: true,
      avatarImageUpdatedAt: true,
    },
  });

  return Response.json({
    avatarImageDataUrl: updatedUser.avatarImageDataUrl,
    avatarImageUpdatedAt: updatedUser.avatarImageUpdatedAt,
    ok: true,
  });
}

export async function DELETE(request: NextRequest) {
  if (!requireSameOrigin(request)) {
    return formError("Requisição inválida.", 403);
  }

  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Faça login para alterar seu avatar." }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      avatarImageDataUrl: null,
      avatarImageMimeType: null,
      avatarImageUpdatedAt: null,
    },
  });

  return Response.json({ avatarImageDataUrl: null, ok: true });
}
