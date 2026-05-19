import { NextRequest } from "next/server";
import type { MatchPhase } from "@prisma/client";

import { writeAuditLog } from "@/lib/admin/audit";
import { redirectBack, requireAdminApi, shouldRedirectBack } from "@/lib/admin/auth";
import { asNumber, asString, readRequestData } from "@/lib/admin/forms";
import { prisma } from "@/lib/prisma";

const phases = new Set(["group", "round_of_32", "round_of_16", "quarter_final", "semi_final", "third_place", "final"]);

function parsePhase(value: unknown): MatchPhase | null {
  const phase = asString(value);
  return phases.has(phase) ? phase as MatchPhase : null;
}

export async function POST(request: NextRequest) {
  const { response, user } = await requireAdminApi(request, true);

  if (response || !user) {
    return response;
  }

  const data = await readRequestData(request);
  const phase = parsePhase(data.phase);
  const oneTeamGoalsPoints = asNumber(data.oneTeamGoalsPoints);
  const outcomePoints = asNumber(data.outcomePoints);
  const scorelinePoints = asNumber(data.scorelinePoints);
  const exactCapPoints = asNumber(data.exactCapPoints);

  if (
    !phase ||
    oneTeamGoalsPoints === null ||
    outcomePoints === null ||
    scorelinePoints === null ||
    exactCapPoints === null
  ) {
    return Response.json({ error: "Regra de pontuação inválida." }, { status: 400 });
  }

  const before = await prisma.scoringRule.findMany({
    where: { phase, activeTo: null },
  });
  const now = new Date();

  await prisma.scoringRule.updateMany({
    where: { phase, activeTo: null },
    data: { activeTo: now },
  });
  const after = await prisma.scoringRule.create({
    data: {
      phase,
      oneTeamGoalsPoints,
      outcomePoints,
      scorelinePoints,
      exactCapPoints,
      activeFrom: now,
      createdByUserId: user.id,
    },
  });

  await writeAuditLog({
    actorUserId: user.id,
    action: "scoring_rule.version",
    targetEntity: "scoring_rule",
    targetId: after.id,
    before,
    after,
  });

  if (shouldRedirectBack(request)) {
    return redirectBack(request, "/admin/scoring");
  }

  return Response.json({ ok: true, rule: after });
}
