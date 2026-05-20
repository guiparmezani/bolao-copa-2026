import { NextRequest } from "next/server";

import { writeAuditLog } from "@/lib/admin/audit";
import { requireAdminApi } from "@/lib/admin/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ entity: string }>;
};

const exporters = {
  users: () =>
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { displayName: "asc" },
    }),
  matches: () =>
    prisma.match.findMany({
      select: {
        matchNumber: true,
        phase: true,
        groupName: true,
        kickoffAt: true,
        status: true,
        publicationStatus: true,
        homeGoals: true,
        awayGoals: true,
      },
      orderBy: [{ kickoffAt: "asc" }, { matchNumber: "asc" }],
    }),
  predictions: async () => {
    const [matchPredictions, placementPredictions] = await Promise.all([
      prisma.matchPrediction.findMany({
        include: {
          match: {
            include: {
              awayTeam: true,
              homeTeam: true,
            },
          },
          submission: true,
          user: true,
        },
        orderBy: [
          { user: { displayName: "asc" } },
          { match: { kickoffAt: "asc" } },
          { match: { matchNumber: "asc" } },
        ],
      }),
      prisma.placementPrediction.findMany({
        include: {
          submission: true,
          team: true,
          user: true,
        },
        orderBy: [{ user: { displayName: "asc" } }, { placement: "asc" }],
      }),
    ]);

    return [
      ...matchPredictions.map((prediction) => ({
        tipo: "placar",
        jogador: prediction.user.displayName,
        email: prediction.user.email ?? prediction.user.emailNormalized ?? "",
        faseEnvio: prediction.submission.phaseGroup,
        statusEnvio: prediction.submission.status,
        confirmadoEm: prediction.confirmedAt,
        jogo: prediction.match.matchNumber,
        faseJogo: prediction.match.phase,
        dataJogo: prediction.match.kickoffAt,
        mandante: prediction.match.homeTeam?.namePt ?? prediction.match.homePlaceholder,
        visitante: prediction.match.awayTeam?.namePt ?? prediction.match.awayPlaceholder,
        palpiteMandante: prediction.homeGoals,
        palpiteVisitante: prediction.awayGoals,
        colocacao: "",
        selecaoEscolhida: "",
      })),
      ...placementPredictions.map((prediction) => ({
        tipo: "colocacao",
        jogador: prediction.user.displayName,
        email: prediction.user.email ?? prediction.user.emailNormalized ?? "",
        faseEnvio: prediction.submission.phaseGroup,
        statusEnvio: prediction.submission.status,
        confirmadoEm: prediction.confirmedAt,
        jogo: "",
        faseJogo: "",
        dataJogo: "",
        mandante: "",
        visitante: "",
        palpiteMandante: "",
        palpiteVisitante: "",
        colocacao: prediction.placement,
        selecaoEscolhida: prediction.team.namePt,
      })),
    ];
  },
  scores: () =>
    prisma.matchPredictionScore.findMany({
      select: {
        userId: true,
        matchId: true,
        totalPoints: true,
        isExact: true,
        isOutcomeCorrect: true,
      },
      orderBy: { computedAt: "desc" },
    }),
  leaderboard: () =>
    prisma.leaderboardSnapshot.findMany({
      select: {
        rank: true,
        userId: true,
        totalPoints: true,
        exactCount: true,
        outcomeCount: true,
        oneTeamGoalsCount: true,
        computedAt: true,
      },
      orderBy: { rank: "asc" },
    }),
} as const;

const fallbackHeaders = {
  predictions: [
    "tipo",
    "jogador",
    "email",
    "faseEnvio",
    "statusEnvio",
    "confirmadoEm",
    "jogo",
    "faseJogo",
    "dataJogo",
    "mandante",
    "visitante",
    "palpiteMandante",
    "palpiteVisitante",
    "colocacao",
    "selecaoEscolhida",
  ],
} as const;

function serialize(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value === "object" && "toString" in value) {
    return String(value);
  }

  return value ?? "";
}

function toCsv(rows: Array<Record<string, unknown>>, headers?: readonly string[]) {
  const csvHeaders = rows.length > 0 ? Object.keys(rows[0]) : headers;

  if (!csvHeaders || csvHeaders.length === 0) {
    return "";
  }

  const lines = [
    csvHeaders.join(","),
    ...rows.map((row) =>
      csvHeaders
        .map((header) => `"${String(serialize(row[header])).replaceAll('"', '""')}"`)
        .join(","),
    ),
  ];

  return `${lines.join("\n")}\n`;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { response, user } = await requireAdminApi(request);

  if (response || !user) {
    return response;
  }

  const { entity } = await context.params;

  if (!(entity in exporters)) {
    return Response.json({ error: "Exportação inválida." }, { status: 404 });
  }

  const rows = await exporters[entity as keyof typeof exporters]();
  await writeAuditLog({
    actorUserId: user.id,
    action: "export.download",
    targetEntity: entity,
    after: { rows: rows.length },
  });

  return new Response(
    toCsv(
      rows as Array<Record<string, unknown>>,
      fallbackHeaders[entity as keyof typeof fallbackHeaders],
    ),
    {
      headers: {
        "content-disposition": `attachment; filename="${entity}.csv"`,
        "content-type": "text/csv; charset=utf-8",
      },
    },
  );
}
