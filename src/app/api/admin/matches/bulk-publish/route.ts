import { NextRequest } from "next/server";

import { writeAuditLog } from "@/lib/admin/audit";
import { redirectBackWithMessage, requireAdminApi, shouldRedirectBack } from "@/lib/admin/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const { response, user } = await requireAdminApi(request, true);

  if (response || !user) {
    return response;
  }

  const before = await prisma.match.count({ where: { publicationStatus: "draft" } });
  const result = await prisma.match.updateMany({
    where: { publicationStatus: "draft" },
    data: {
      publicationStatus: "published",
      publishedAt: new Date(),
      publishedByUserId: user.id,
    },
  });

  await writeAuditLog({
    actorUserId: user.id,
    action: "match.bulk_publish",
    targetEntity: "match",
    before: { draftCount: before },
    after: result,
  });

  if (shouldRedirectBack(request)) {
    return redirectBackWithMessage(
      request,
      "/admin/matches",
      "mensagem",
      `${result.count} jogo(s) importado(s) publicado(s).`,
    );
  }

  return Response.json({ ok: true, result });
}
