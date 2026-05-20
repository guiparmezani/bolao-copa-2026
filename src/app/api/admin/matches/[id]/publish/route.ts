import { NextRequest } from "next/server";

import { writeAuditLog } from "@/lib/admin/audit";
import {
  redirectBackWithMessage,
  requireAdminApi,
  shouldRedirectBack,
} from "@/lib/admin/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { response, user } = await requireAdminApi(request, true);

  if (response || !user) {
    return response;
  }

  const { id } = await context.params;
  const before = await prisma.match.findUnique({ where: { id } });

  if (!before) {
    return Response.json({ error: "Jogo não encontrado." }, { status: 404 });
  }

  const after = await prisma.match.update({
    where: { id },
    data: {
      publicationStatus: "published",
      publishedAt: before.publishedAt ?? new Date(),
      publishedByUserId: before.publishedByUserId ?? user.id,
    },
  });
  await writeAuditLog({
    actorUserId: user.id,
    action: "match.publish",
    targetEntity: "match",
    targetId: id,
    before,
    after,
  });

  if (shouldRedirectBack(request)) {
    return redirectBackWithMessage(
      request,
      "/admin/matches",
      "mensagem",
      `Jogo ${before.matchNumber} publicado.`,
    );
  }

  return Response.json({ ok: true, match: after });
}
