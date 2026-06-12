import { NextRequest } from "next/server";

import { writeAuditLog } from "@/lib/admin/audit";
import { requireAdminApi } from "@/lib/admin/auth";
import { getRequestOrigin } from "@/lib/auth/http";
import {
  createPasswordResetToken,
  getPasswordResetExpiresAt,
  hashPasswordResetToken,
} from "@/lib/auth/password-reset";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function formatExpiresAt(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(value);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { response, user: actor } = await requireAdminApi(request, true);

  if (response || !actor) {
    return response;
  }

  const { id } = await context.params;
  const before = await prisma.user.findUnique({
    where: { id },
    select: {
      email: true,
      id: true,
      passwordResetTokenHash: true,
      status: true,
    },
  });

  if (!before || before.status === "deleted") {
    return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  const token = createPasswordResetToken();
  const expiresAt = getPasswordResetExpiresAt();

  await prisma.user.update({
    where: { id },
    data: {
      passwordResetTokenExpiresAt: expiresAt,
      passwordResetTokenHash: hashPasswordResetToken(token),
    },
  });

  await writeAuditLog({
    actorUserId: actor.id,
    action: "user.password_reset_link.create",
    targetEntity: "user",
    targetId: id,
    before: { email: before.email, hadExistingResetToken: Boolean(before.passwordResetTokenHash) },
    after: { expiresAt },
  });

  const resetUrl = new URL("/reset-password", getRequestOrigin(request));
  resetUrl.searchParams.set("token", token);

  return Response.json({
    expiresAt: formatExpiresAt(expiresAt),
    ok: true,
    resetUrl: resetUrl.toString(),
  });
}
