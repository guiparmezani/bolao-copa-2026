import { NextRequest } from "next/server";

import { writeAuditLog } from "@/lib/admin/audit";
import { redirectBack, requireAdminApi, shouldRedirectBack } from "@/lib/admin/auth";
import { recomputeLeaderboard } from "@/lib/leaderboard";

export async function POST(request: NextRequest) {
  const { response, user } = await requireAdminApi(request, true);

  if (response || !user) {
    return response;
  }

  const result = await recomputeLeaderboard();
  await writeAuditLog({
    actorUserId: user.id,
    action: "leaderboard.recompute",
    targetEntity: "leaderboard",
    after: result,
  });

  if (shouldRedirectBack(request)) {
    return redirectBack(request);
  }

  return Response.json({ ok: true, result });
}
