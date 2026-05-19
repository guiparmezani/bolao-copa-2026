import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";

import { writeAuditLog } from "@/lib/admin/audit";
import { requireAdminApi } from "@/lib/admin/auth";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { response, user: actor } = await requireAdminApi(request, true);

  if (response || !actor) {
    return response;
  }

  const { id } = await context.params;
  const before = await prisma.user.findUnique({ where: { id } });

  if (!before) {
    return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  const temporaryPassword = `Bolao-${randomBytes(4).toString("hex")}-2026`;
  await prisma.user.update({
    where: { id },
    data: {
      passwordHash: await hashPassword(temporaryPassword),
    },
  });
  await prisma.session.updateMany({
    where: { userId: id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await writeAuditLog({
    actorUserId: actor.id,
    action: "user.reset_password",
    targetEntity: "user",
    targetId: id,
    before: { username: before.username },
    after: { sessionsRevoked: true },
  });

  return Response.json({ ok: true, temporaryPassword });
}
