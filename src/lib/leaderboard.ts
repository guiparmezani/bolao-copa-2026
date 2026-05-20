import { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getActiveScoringRuleConfigs, getPlacementBonuses } from "@/lib/rules";
import { scorePrediction, type MatchPhase, type ScoringRuleConfig } from "@/lib/scoring";

type LeaderboardClient = PrismaClient | typeof prisma;

function toDecimal(value: number) {
  return new Prisma.Decimal(value);
}

async function getActiveScoringRules(client: LeaderboardClient) {
  const rules = await getActiveScoringRuleConfigs(client);
  const byPhase = new Map<MatchPhase, ScoringRuleConfig>();

  for (const rule of rules) {
    byPhase.set(rule.phase, rule);
  }

  return byPhase;
}

function getWinnerTeamId(match: { homeTeamId: string | null; awayTeamId: string | null; homeGoals: number | null; awayGoals: number | null; winnerTeamId: string | null }) {
  if (match.winnerTeamId) {
    return match.winnerTeamId;
  }

  if (match.homeGoals === null || match.awayGoals === null || match.homeGoals === match.awayGoals) {
    return null;
  }

  return match.homeGoals > match.awayGoals ? match.homeTeamId : match.awayTeamId;
}

function getFinalRunnerUpTeamId(match: { homeTeamId: string | null; awayTeamId: string | null; homeGoals: number | null; awayGoals: number | null; winnerTeamId: string | null }) {
  const winnerTeamId = getWinnerTeamId(match);

  if (!winnerTeamId) {
    return null;
  }

  if (match.homeTeamId === winnerTeamId) {
    return match.awayTeamId;
  }

  if (match.awayTeamId === winnerTeamId) {
    return match.homeTeamId;
  }

  return null;
}

async function getPlacementPointsByUser(client: LeaderboardClient) {
  const [bonuses, finalMatch, thirdPlaceMatch, placementPredictions] = await Promise.all([
    getPlacementBonuses(client),
    client.match.findFirst({
      where: {
        phase: "final",
        status: "finished",
        homeGoals: { not: null },
        awayGoals: { not: null },
      },
    }),
    client.match.findFirst({
      where: {
        phase: "third_place",
        status: "finished",
        homeGoals: { not: null },
        awayGoals: { not: null },
      },
    }),
    client.placementPrediction.findMany({
      where: {
        confirmedAt: { not: null },
        submission: {
          status: "confirmed",
        },
      },
    }),
  ]);

  const actualTeamByPlacement = {
    champion: finalMatch ? getWinnerTeamId(finalMatch) : null,
    runner_up: finalMatch ? getFinalRunnerUpTeamId(finalMatch) : null,
    third_place: thirdPlaceMatch ? getWinnerTeamId(thirdPlaceMatch) : null,
  };
  const pointsByUser = new Map<string, number>();

  for (const prediction of placementPredictions) {
    if (prediction.teamId !== actualTeamByPlacement[prediction.placement]) {
      continue;
    }

    pointsByUser.set(
      prediction.userId,
      (pointsByUser.get(prediction.userId) ?? 0) + bonuses[prediction.placement],
    );
  }

  return pointsByUser;
}

type LeaderboardRow = {
  userId: string;
  totalPoints: number;
  exactCount: number;
  outcomeCount: number;
  oneTeamGoalsCount: number;
  earliestConfirmedAt: Date | null;
};

function compareRows(a: LeaderboardRow, b: LeaderboardRow) {
  return (
    b.totalPoints - a.totalPoints ||
    b.exactCount - a.exactCount ||
    b.outcomeCount - a.outcomeCount ||
    b.oneTeamGoalsCount - a.oneTeamGoalsCount ||
    (a.earliestConfirmedAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
      (b.earliestConfirmedAt?.getTime() ?? Number.MAX_SAFE_INTEGER)
  );
}

function isSameRank(a: LeaderboardRow, b: LeaderboardRow) {
  return compareRows(a, b) === 0;
}

export async function recomputeLeaderboard(client: LeaderboardClient = prisma) {
  const rulesByPhase = await getActiveScoringRules(client);
  const predictions = await client.matchPrediction.findMany({
    where: {
      confirmedAt: { not: null },
      submission: {
        status: "confirmed",
      },
    },
    include: {
      match: true,
      submission: true,
    },
  });
  const now = new Date();
  const userRows = new Map<string, LeaderboardRow>();

  for (const prediction of predictions) {
    if (
      prediction.match.status !== "finished" ||
      prediction.match.homeGoals === null ||
      prediction.match.awayGoals === null
    ) {
      await client.matchPredictionScore.deleteMany({
        where: {
          matchPredictionId: prediction.id,
        },
      });
      continue;
    }

    const rule = rulesByPhase.get(prediction.match.phase as MatchPhase);

    if (!rule) {
      throw new Error(`Missing scoring rule for phase ${prediction.match.phase}.`);
    }

    const score = scorePrediction({
      predictedHomeGoals: prediction.homeGoals,
      predictedAwayGoals: prediction.awayGoals,
      actualHomeGoals: prediction.match.homeGoals,
      actualAwayGoals: prediction.match.awayGoals,
      rule,
    });

    await client.matchPredictionScore.upsert({
      where: {
        matchPredictionId: prediction.id,
      },
      update: {
        matchId: prediction.matchId,
        userId: prediction.userId,
        phase: prediction.match.phase,
        oneTeamGoalsPoints: toDecimal(score.oneTeamGoalsPoints),
        outcomePoints: toDecimal(score.outcomePoints),
        scorelinePoints: toDecimal(score.scorelinePoints),
        totalPoints: toDecimal(score.totalPoints),
        isExact: score.isExact,
        isOutcomeCorrect: score.isOutcomeCorrect,
        isOneTeamGoalsCorrect: score.isOneTeamGoalsCorrect,
        computedAt: now,
      },
      create: {
        matchPredictionId: prediction.id,
        matchId: prediction.matchId,
        userId: prediction.userId,
        phase: prediction.match.phase,
        oneTeamGoalsPoints: toDecimal(score.oneTeamGoalsPoints),
        outcomePoints: toDecimal(score.outcomePoints),
        scorelinePoints: toDecimal(score.scorelinePoints),
        totalPoints: toDecimal(score.totalPoints),
        isExact: score.isExact,
        isOutcomeCorrect: score.isOutcomeCorrect,
        isOneTeamGoalsCorrect: score.isOneTeamGoalsCorrect,
        computedAt: now,
      },
    });

    const row = userRows.get(prediction.userId) ?? {
      userId: prediction.userId,
      totalPoints: 0,
      exactCount: 0,
      outcomeCount: 0,
      oneTeamGoalsCount: 0,
      earliestConfirmedAt: null,
    };

    row.totalPoints += score.totalPoints;
    row.exactCount += score.isExact ? 1 : 0;
    row.outcomeCount += score.isOutcomeCorrect ? 1 : 0;
    row.oneTeamGoalsCount += score.isOneTeamGoalsCorrect ? 1 : 0;

    const confirmedAt = prediction.submission.confirmedAt ?? prediction.confirmedAt;
    if (confirmedAt && (!row.earliestConfirmedAt || confirmedAt < row.earliestConfirmedAt)) {
      row.earliestConfirmedAt = confirmedAt;
    }

    userRows.set(prediction.userId, row);
  }

  const placementPointsByUser = await getPlacementPointsByUser(client);
  for (const [userId, points] of placementPointsByUser) {
    const row = userRows.get(userId) ?? {
      userId,
      totalPoints: 0,
      exactCount: 0,
      outcomeCount: 0,
      oneTeamGoalsCount: 0,
      earliestConfirmedAt: null,
    };
    row.totalPoints += points;
    userRows.set(userId, row);
  }

  const sortedRows = [...userRows.values()].sort(compareRows);
  const rankedRows: Array<LeaderboardRow & { rank: number }> = [];
  for (const [index, row] of sortedRows.entries()) {
    rankedRows.push({
      ...row,
      rank: index > 0 && isSameRank(row, sortedRows[index - 1])
        ? rankedRows[index - 1].rank
        : index + 1,
    });
  }

  for (const row of rankedRows) {
    await client.leaderboardSnapshot.upsert({
      where: {
        userId: row.userId,
      },
      update: {
        totalPoints: toDecimal(row.totalPoints),
        exactCount: row.exactCount,
        outcomeCount: row.outcomeCount,
        oneTeamGoalsCount: row.oneTeamGoalsCount,
        rank: row.rank,
        computedAt: now,
      },
      create: {
        userId: row.userId,
        totalPoints: toDecimal(row.totalPoints),
        exactCount: row.exactCount,
        outcomeCount: row.outcomeCount,
        oneTeamGoalsCount: row.oneTeamGoalsCount,
        rank: row.rank,
        computedAt: now,
      },
    });
  }

  await client.leaderboardSnapshot.deleteMany({
    where: {
      userId: {
        notIn: rankedRows.map((row) => row.userId),
      },
    },
  });

  return {
    computedAt: now,
    scoredPredictions: predictions.length,
    leaderboardRows: rankedRows.length,
  };
}
