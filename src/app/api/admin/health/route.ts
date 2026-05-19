import { NextRequest } from "next/server";

import { requireAdminApi } from "@/lib/admin/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { response } = await requireAdminApi(request);

  if (response) {
    return response;
  }

  const [
    users,
    groupConfirmed,
    groupPending,
    knockoutConfirmed,
    knockoutPending,
    placementConfirmed,
    placementPending,
    failedSyncs,
    lastStaticSync,
    lastLiveSync,
    lastLeaderboard,
    finishedMatches,
    scoredMatches,
  ] = await Promise.all([
    prisma.user.count({ where: { status: "active" } }),
    prisma.predictionSubmission.count({ where: { phaseGroup: "group", status: "confirmed" } }),
    prisma.predictionSubmission.count({ where: { phaseGroup: "group", status: "draft" } }),
    prisma.predictionSubmission.count({ where: { phaseGroup: "knockout", status: "confirmed" } }),
    prisma.predictionSubmission.count({ where: { phaseGroup: "knockout", status: "draft" } }),
    prisma.predictionSubmission.count({ where: { phaseGroup: "placement", status: "confirmed" } }),
    prisma.predictionSubmission.count({ where: { phaseGroup: "placement", status: "draft" } }),
    prisma.providerSyncLog.count({ where: { status: "failed" } }),
    prisma.providerSyncLog.findFirst({
      where: { syncType: "static_tournament_data", status: "success" },
      orderBy: { finishedAt: "desc" },
    }),
    prisma.providerSyncLog.findFirst({
      where: { syncType: "live_matches", status: "success" },
      orderBy: { finishedAt: "desc" },
    }),
    prisma.leaderboardSnapshot.findFirst({ orderBy: { computedAt: "desc" } }),
    prisma.match.findMany({
      where: { status: "finished", homeGoals: { not: null }, awayGoals: { not: null } },
      select: { id: true },
    }),
    prisma.matchPredictionScore.findMany({ distinct: ["matchId"], select: { matchId: true } }),
  ]);

  const scoredMatchIds = new Set(scoredMatches.map((score) => score.matchId));
  const matchesFinishedButNotScored = finishedMatches.filter(
    (match) => !scoredMatchIds.has(match.id),
  ).length;

  return Response.json({
    users,
    submissions: {
      group: { confirmed: groupConfirmed, pending: groupPending },
      knockout: { confirmed: knockoutConfirmed, pending: knockoutPending },
      placement: { confirmed: placementConfirmed, pending: placementPending },
    },
    sync: {
      failedSyncs,
      lastStaticSync,
      lastLiveSync,
      rateLimitState: "not_configured",
    },
    scoring: {
      matchesFinishedButNotScored,
      leaderboardLastComputedAt: lastLeaderboard?.computedAt ?? null,
    },
  });
}
