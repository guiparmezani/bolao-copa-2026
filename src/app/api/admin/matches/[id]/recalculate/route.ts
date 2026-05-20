import { NextRequest } from "next/server";

import { writeAuditLog } from "@/lib/admin/audit";
import { redirectBackWithMessage, requireAdminApi, shouldRedirectBack } from "@/lib/admin/auth";
import { recomputeLeaderboard } from "@/lib/leaderboard";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { response, user } = await requireAdminApi(request, true);

  if (response || !user) {
    return response;
  }

  const { id } = await context.params;
  const result = await recomputeLeaderboard();
  await writeAuditLog({
    actorUserId: user.id,
    action: "match.recalculate",
    targetEntity: "match",
    targetId: id,
    after: result,
  });

  if (shouldRedirectBack(request)) {
    return redirectBackWithMessage(
      request,
      "/admin/matches",
      "mensagem",
      `Ranking recalculado para ${result.leaderboardRows} jogador(es).`,
    );
  }

  return Response.json({ ok: true, result });
}
