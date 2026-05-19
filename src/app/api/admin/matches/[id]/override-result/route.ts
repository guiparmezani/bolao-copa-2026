import { NextRequest } from "next/server";

import { writeAuditLog } from "@/lib/admin/audit";
import { redirectBack, requireAdminApi, shouldRedirectBack } from "@/lib/admin/auth";
import { asNumber, asString, readRequestData } from "@/lib/admin/forms";
import { recomputeLeaderboard } from "@/lib/leaderboard";
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
  const data = await readRequestData(request);
  const before = await prisma.match.findUnique({ where: { id } });

  if (!before) {
    return Response.json({ error: "Jogo não encontrado." }, { status: 404 });
  }

  if (asString(data.confirmation) !== "CONFIRMAR") {
    return Response.json({ error: "Digite CONFIRMAR para sobrescrever resultado." }, { status: 400 });
  }

  const homeGoals = asNumber(data.homeGoals);
  const awayGoals = asNumber(data.awayGoals);

  if (homeGoals === null || awayGoals === null) {
    return Response.json({ error: "Informe os gols oficiais do bolão." }, { status: 400 });
  }

  const after = await prisma.match.update({
    where: { id },
    data: {
      status: "finished",
      homeGoals,
      awayGoals,
      homeGoalsFullTime: asNumber(data.homeGoalsFullTime),
      awayGoalsFullTime: asNumber(data.awayGoalsFullTime),
      homeGoalsExtraTime: asNumber(data.homeGoalsExtraTime),
      awayGoalsExtraTime: asNumber(data.awayGoalsExtraTime),
      homePenalties: asNumber(data.homePenalties),
      awayPenalties: asNumber(data.awayPenalties),
      manualOverrideAt: new Date(),
      manualOverrideByUserId: user.id,
    },
  });
  const leaderboard = await recomputeLeaderboard();

  await writeAuditLog({
    actorUserId: user.id,
    action: "match.override_result",
    targetEntity: "match",
    targetId: id,
    before,
    after: { match: after, leaderboard },
  });

  if (shouldRedirectBack(request)) {
    return redirectBack(request, "/admin/matches");
  }

  return Response.json({ ok: true, match: after, leaderboard });
}
