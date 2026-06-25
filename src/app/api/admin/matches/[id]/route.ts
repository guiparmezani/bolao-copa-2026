import { NextRequest } from "next/server";
import type { PublicationStatus } from "@prisma/client";

import { writeAuditLog } from "@/lib/admin/audit";
import {
  redirectBackWithMessage,
  requireAdminApi,
  shouldRedirectBack,
} from "@/lib/admin/auth";
import { asDate, asNullableString, asNumber, asString, readRequestData } from "@/lib/admin/forms";
import { recomputeLeaderboard } from "@/lib/leaderboard";
import { prisma } from "@/lib/prisma";
import { openKnockoutPredictionsIfReady } from "@/lib/sync/tournament-sync";
import { syncTournamentProgression } from "@/lib/sync/tournament-progression";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const publicationStatuses = new Set(["draft", "published", "archived"]);

function parsePublicationStatus(value: unknown, fallback: PublicationStatus): PublicationStatus {
  const stringValue = asString(value);
  return publicationStatuses.has(stringValue) ? stringValue as PublicationStatus : fallback;
}

function hasField(data: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function nullableStringField(data: Record<string, unknown>, key: string, fallback: string | null) {
  return hasField(data, key) ? asNullableString(data[key]) : fallback;
}

function nullableNumberField(data: Record<string, unknown>, key: string, fallback: number | null) {
  return hasField(data, key) ? asNumber(data[key]) : fallback;
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

  const kickoffAt = hasField(data, "kickoffAt")
    ? asDate(data.kickoffAt) ?? before.kickoffAt
    : before.kickoffAt;
  const publicationStatus = hasField(data, "publicationStatus")
    ? parsePublicationStatus(data.publicationStatus, before.publicationStatus)
    : before.publicationStatus;
  const homeGoals = nullableNumberField(data, "homeGoals", before.homeGoals);
  const awayGoals = nullableNumberField(data, "awayGoals", before.awayGoals);
  const hasOfficialScore = homeGoals !== null && awayGoals !== null;
  const after = await prisma.match.update({
    where: { id },
    data: {
      kickoffAt,
      venueName: nullableStringField(data, "venueName", before.venueName),
      venueCity: nullableStringField(data, "venueCity", before.venueCity),
      homePlaceholder: nullableStringField(data, "homePlaceholder", before.homePlaceholder),
      awayPlaceholder: nullableStringField(data, "awayPlaceholder", before.awayPlaceholder),
      status: hasOfficialScore ? "finished" : before.status,
      publicationStatus,
      publishedAt: publicationStatus === "published" ? before.publishedAt ?? new Date() : null,
      publishedByUserId: publicationStatus === "published" ? before.publishedByUserId ?? user.id : null,
      homeGoals,
      awayGoals,
      homeGoalsFullTime: nullableNumberField(data, "homeGoalsFullTime", before.homeGoalsFullTime),
      awayGoalsFullTime: nullableNumberField(data, "awayGoalsFullTime", before.awayGoalsFullTime),
      homeGoalsExtraTime: nullableNumberField(data, "homeGoalsExtraTime", before.homeGoalsExtraTime),
      awayGoalsExtraTime: nullableNumberField(data, "awayGoalsExtraTime", before.awayGoalsExtraTime),
      homePenalties: nullableNumberField(data, "homePenalties", before.homePenalties),
      awayPenalties: nullableNumberField(data, "awayPenalties", before.awayPenalties),
    },
  });

  let leaderboard = null;
  let progression = null;
  let openKnockout = null;
  let messageKey: "aviso" | "mensagem" = "mensagem";
  let message = "Metadados salvos.";

  if (hasOfficialScore) {
    leaderboard = await recomputeLeaderboard();
    progression = await syncTournamentProgression();
    openKnockout = await openKnockoutPredictionsIfReady();
    message = `Resultado salvo como Encerrado e ranking recalculado para ${leaderboard.leaderboardRows} jogador(es).`;
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
    after: { match: after, leaderboard, progression, openKnockout },
  });

  if (shouldRedirectBack(request)) {
    return redirectBackWithMessage(request, "/admin/matches", messageKey, message);
  }

  return Response.json({ ok: true, leaderboard, match: after, openKnockout, progression });
}
