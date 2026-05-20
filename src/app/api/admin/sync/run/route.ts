import { NextRequest } from "next/server";

import { writeAuditLog } from "@/lib/admin/audit";
import { redirectBackWithMessage, requireAdminApi, shouldRedirectBack } from "@/lib/admin/auth";
import {
  finalizeFinishedMatches,
  openKnockoutPredictionsIfReady,
  syncLiveMatches,
  syncOfficialStandings,
  syncStaticTournamentData,
} from "@/lib/sync/tournament-sync";

export async function POST(request: NextRequest) {
  const { response, user } = await requireAdminApi(request, true);

  if (response || !user) {
    return response;
  }

  const [staticSync, liveSync, standings, finalize, openKnockout] = await Promise.all([
    syncStaticTournamentData(),
    syncLiveMatches(),
    syncOfficialStandings(),
    finalizeFinishedMatches(),
    openKnockoutPredictionsIfReady(),
  ]);
  const result = { staticSync, liveSync, standings, finalize, openKnockout };

  await writeAuditLog({
    actorUserId: user.id,
    action: "sync.run",
    targetEntity: "provider_sync",
    after: result,
  });

  if (shouldRedirectBack(request)) {
    return redirectBackWithMessage(
      request,
      "/admin",
      "mensagem",
      "Sync executado. Confira os status de dados atualizados.",
    );
  }

  return Response.json({ ok: true, result });
}
