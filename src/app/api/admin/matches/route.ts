import { NextRequest } from "next/server";
import type { MatchPhase, PublicationStatus } from "@prisma/client";

import { writeAuditLog } from "@/lib/admin/audit";
import {
  redirectBackWithMessage,
  requireAdminApi,
  shouldRedirectBack,
} from "@/lib/admin/auth";
import { asDate, asNullableString, asNumber, asString, readRequestData } from "@/lib/admin/forms";
import { prisma } from "@/lib/prisma";

const phases = new Set(["group", "round_of_32", "round_of_16", "quarter_final", "semi_final", "third_place", "final"]);
const publicationStatuses = new Set(["draft", "published", "archived"]);

function parsePhase(value: unknown): MatchPhase {
  const stringValue = asString(value);
  return phases.has(stringValue) ? stringValue as MatchPhase : "group";
}

function parsePublicationStatus(value: unknown): PublicationStatus {
  const stringValue = asString(value);
  return publicationStatuses.has(stringValue) ? stringValue as PublicationStatus : "draft";
}

export async function GET(request: NextRequest) {
  const { response } = await requireAdminApi(request);

  if (response) {
    return response;
  }

  const matches = await prisma.match.findMany({
    include: {
      awayTeam: true,
      homeTeam: true,
      winnerTeam: true,
    },
    orderBy: [{ kickoffAt: "asc" }, { matchNumber: "asc" }],
  });

  return Response.json({ matches });
}

export async function POST(request: NextRequest) {
  const { response, user } = await requireAdminApi(request, true);

  if (response || !user) {
    return response;
  }

  const data = await readRequestData(request);
  const matchNumber = asNumber(data.matchNumber);
  const kickoffAt = asDate(data.kickoffAt);

  if (!matchNumber || !kickoffAt) {
    if (shouldRedirectBack(request)) {
      return redirectBackWithMessage(
        request,
        "/admin/matches",
        "erro",
        "Informe número do jogo e data de início.",
      );
    }

    return Response.json({ error: "Informe número do jogo e data de início." }, { status: 400 });
  }

  const created = await prisma.match.create({
    data: {
      providerSource: "manual",
      providerId: `manual-${matchNumber}`,
      matchNumber,
      phase: parsePhase(data.phase),
      groupName: asNullableString(data.groupName),
      kickoffAt,
      venueName: asNullableString(data.venueName),
      venueCity: asNullableString(data.venueCity),
      homePlaceholder: asNullableString(data.homePlaceholder),
      awayPlaceholder: asNullableString(data.awayPlaceholder),
      publicationStatus: parsePublicationStatus(data.publicationStatus),
      publishedAt: data.publicationStatus === "published" ? new Date() : null,
      publishedByUserId: data.publicationStatus === "published" ? user.id : null,
    },
  });

  await writeAuditLog({
    actorUserId: user.id,
    action: "match.create",
    targetEntity: "match",
    targetId: created.id,
    after: created,
  });

  if (shouldRedirectBack(request)) {
    return redirectBackWithMessage(
      request,
      "/admin/matches",
      "mensagem",
      `Jogo ${created.matchNumber} criado.`,
    );
  }

  return Response.json({ ok: true, match: created });
}
