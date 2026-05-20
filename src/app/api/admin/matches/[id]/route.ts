import { NextRequest } from "next/server";
import type { MatchStatus, PublicationStatus } from "@prisma/client";

import { writeAuditLog } from "@/lib/admin/audit";
import {
  redirectBackWithMessage,
  requireAdminApi,
  shouldRedirectBack,
} from "@/lib/admin/auth";
import { asDate, asNullableString, asNumber, asString, readRequestData } from "@/lib/admin/forms";
import { recomputeLeaderboard } from "@/lib/leaderboard";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const statuses = new Set(["scheduled", "live", "paused", "finished", "postponed", "cancelled"]);
const publicationStatuses = new Set(["draft", "published", "archived"]);

function parseStatus(value: unknown, fallback: MatchStatus): MatchStatus {
  const stringValue = asString(value);
  return statuses.has(stringValue) ? stringValue as MatchStatus : fallback;
}

function parsePublicationStatus(value: unknown, fallback: PublicationStatus): PublicationStatus {
  const stringValue = asString(value);
  return publicationStatuses.has(stringValue) ? stringValue as PublicationStatus : fallback;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return updateMatch(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return updateMatch(request, context);
}

async function updateMatch(request: NextRequest, context: RouteContext) {
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

  const kickoffAt = asDate(data.kickoffAt);
  const publicationStatus = parsePublicationStatus(data.publicationStatus, before.publicationStatus);
  const after = await prisma.match.update({
    where: { id },
    data: {
      kickoffAt: kickoffAt ?? before.kickoffAt,
      venueName: asNullableString(data.venueName),
      venueCity: asNullableString(data.venueCity),
      homePlaceholder: asNullableString(data.homePlaceholder),
      awayPlaceholder: asNullableString(data.awayPlaceholder),
      status: parseStatus(data.status, before.status),
      publicationStatus,
      publishedAt: publicationStatus === "published" ? before.publishedAt ?? new Date() : null,
      publishedByUserId: publicationStatus === "published" ? before.publishedByUserId ?? user.id : null,
      homeGoals: asNumber(data.homeGoals),
      awayGoals: asNumber(data.awayGoals),
      homeGoalsFullTime: asNumber(data.homeGoalsFullTime),
      awayGoalsFullTime: asNumber(data.awayGoalsFullTime),
      homeGoalsExtraTime: asNumber(data.homeGoalsExtraTime),
      awayGoalsExtraTime: asNumber(data.awayGoalsExtraTime),
      homePenalties: asNumber(data.homePenalties),
      awayPenalties: asNumber(data.awayPenalties),
    },
  });

  const hasOfficialScore = after.homeGoals !== null && after.awayGoals !== null;
  let leaderboard = null;
  let messageKey: "aviso" | "mensagem" = "mensagem";
  let message = "Metadados salvos.";

  if (after.status === "finished" && hasOfficialScore) {
    leaderboard = await recomputeLeaderboard();
    message = `Metadados salvos e ranking recalculado para ${leaderboard.leaderboardRows} jogador(es).`;
  } else if (hasOfficialScore) {
    messageKey = "aviso";
    message = "Metadados salvos. O ranking só pontua jogos com status Encerrado.";
  } else if (after.status === "finished") {
    messageKey = "aviso";
    message = "Metadados salvos. Informe os gols oficiais para pontuar o ranking.";
  }

  await writeAuditLog({
    actorUserId: user.id,
    action: "match.update",
    targetEntity: "match",
    targetId: id,
    before,
    after: { match: after, leaderboard },
  });

  if (shouldRedirectBack(request)) {
    return redirectBackWithMessage(request, "/admin/matches", messageKey, message);
  }

  return Response.json({ ok: true, leaderboard, match: after });
}
