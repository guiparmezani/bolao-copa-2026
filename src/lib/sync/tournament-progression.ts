import type { Prisma, PrismaClient, QualificationStatus } from "@prisma/client";

import { prisma } from "../prisma";
import { withProviderSyncLog } from "./provider-logs";
import {
  getThirdPlacePairing,
  thirdPlacePairingSlots,
  type ThirdPlacePairingSlot,
} from "./third-place-pairings";

type ProgressionClient = PrismaClient | typeof prisma;

export type TeamSeed = {
  id: string;
  providerId: string;
  nameEn: string;
  groupName: string;
  fairPlayPoints: number | null;
  fifaRankingCurrent: number | null;
};

export type GroupMatch = {
  groupName: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  status: string;
};

export type ComputedGroupStanding = {
  teamId: string;
  providerId: string;
  groupName: string;
  rank: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  fairPlayPoints: number | null;
  fifaRankingCurrent: number | null;
  qualificationStatus: QualificationStatus;
  rankUnresolved: boolean;
};

type GroupProgression = {
  complete: boolean;
  groupLetter: string;
  groupName: string;
  unresolvedRanks: Set<number>;
  standings: ComputedGroupStanding[];
};

type RankedBucket<T> = T[];

type RankCriterion<T> = {
  direction: "asc" | "desc";
  value: (item: T) => number | null;
};

export type TournamentProgressionResult = {
  bestThirdPlaceGroups: string[];
  completeGroups: number;
  resolvedRoundOf32Slots: number;
  standingsUpdated: number;
  unresolvedRoundOf32Slots: number;
};

const progressionSource = "local-progression";
const groupLetters = "ABCDEFGHIJKL".split("");

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function finishedWithScore(match: GroupMatch) {
  return match.status === "finished" && match.homeGoals !== null && match.awayGoals !== null;
}

function groupLetterFromName(groupName: string) {
  return groupName.replace(/^Grupo\s+/i, "").trim().toUpperCase();
}

function compareSeedOrder(a: TeamSeed | ComputedGroupStanding, b: TeamSeed | ComputedGroupStanding) {
  const left = "nameEn" in a ? a.nameEn : a.providerId;
  const right = "nameEn" in b ? b.nameEn : b.providerId;

  return left.localeCompare(right, "en");
}

function blankStanding(team: TeamSeed): ComputedGroupStanding {
  return {
    teamId: team.id,
    providerId: team.providerId,
    groupName: team.groupName,
    rank: 0,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    fairPlayPoints: team.fairPlayPoints,
    fifaRankingCurrent: team.fifaRankingCurrent,
    qualificationStatus: "unknown",
    rankUnresolved: false,
  };
}

function addMatchToStanding(
  standing: ComputedGroupStanding,
  goalsFor: number,
  goalsAgainst: number,
) {
  standing.played += 1;
  standing.goalsFor += goalsFor;
  standing.goalsAgainst += goalsAgainst;
  standing.goalDifference = standing.goalsFor - standing.goalsAgainst;

  if (goalsFor > goalsAgainst) {
    standing.wins += 1;
    standing.points += 3;
  } else if (goalsFor === goalsAgainst) {
    standing.draws += 1;
    standing.points += 1;
  } else {
    standing.losses += 1;
  }
}

function splitBucketByCriterion<T>(
  bucket: RankedBucket<T>,
  criterion: RankCriterion<T>,
): RankedBucket<T>[] {
  if (bucket.length <= 1) {
    return [bucket];
  }

  const values = bucket.map((item) => criterion.value(item));

  if (values.some((value) => value === null)) {
    return [bucket];
  }

  const grouped = new Map<number, T[]>();

  bucket.forEach((item, index) => {
    const value = values[index] as number;
    const items = grouped.get(value) ?? [];
    items.push(item);
    grouped.set(value, items);
  });

  if (grouped.size <= 1) {
    return [bucket];
  }

  const sortedValues = [...grouped.keys()].sort((a, b) =>
    criterion.direction === "desc" ? b - a : a - b,
  );

  return sortedValues.map((value) => grouped.get(value) as T[]);
}

function applyCriteria<T>(buckets: RankedBucket<T>[], criteria: RankCriterion<T>[]) {
  return criteria.reduce<RankedBucket<T>[]>((currentBuckets, criterion) => {
    return currentBuckets.flatMap((bucket) => splitBucketByCriterion(bucket, criterion));
  }, buckets);
}

function headToHeadMetrics(
  teamId: string,
  tiedTeamIds: Set<string>,
  groupMatches: GroupMatch[],
) {
  const metrics = { points: 0, goalDifference: 0, goalsFor: 0 };

  for (const match of groupMatches) {
    if (
      !finishedWithScore(match) ||
      !match.homeTeamId ||
      !match.awayTeamId ||
      !tiedTeamIds.has(match.homeTeamId) ||
      !tiedTeamIds.has(match.awayTeamId) ||
      (match.homeTeamId !== teamId && match.awayTeamId !== teamId)
    ) {
      continue;
    }

    const isHome = match.homeTeamId === teamId;
    const goalsFor = isHome ? match.homeGoals as number : match.awayGoals as number;
    const goalsAgainst = isHome ? match.awayGoals as number : match.homeGoals as number;

    metrics.goalsFor += goalsFor;
    metrics.goalDifference += goalsFor - goalsAgainst;

    if (goalsFor > goalsAgainst) {
      metrics.points += 3;
    } else if (goalsFor === goalsAgainst) {
      metrics.points += 1;
    }
  }

  return metrics;
}

function headToHeadCriteria(
  bucket: ComputedGroupStanding[],
  groupMatches: GroupMatch[],
): RankCriterion<ComputedGroupStanding>[] {
  const tiedTeamIds = new Set(bucket.map((standing) => standing.teamId));
  const metricsByTeamId = new Map(
    bucket.map((standing) => [
      standing.teamId,
      headToHeadMetrics(standing.teamId, tiedTeamIds, groupMatches),
    ]),
  );

  return [
    {
      direction: "desc",
      value: (standing) => metricsByTeamId.get(standing.teamId)?.points ?? 0,
    },
    {
      direction: "desc",
      value: (standing) => metricsByTeamId.get(standing.teamId)?.goalDifference ?? 0,
    },
    {
      direction: "desc",
      value: (standing) => metricsByTeamId.get(standing.teamId)?.goalsFor ?? 0,
    },
  ];
}

function allGroupCriteria(): RankCriterion<ComputedGroupStanding>[] {
  return [
    { direction: "desc", value: (standing) => standing.goalDifference },
    { direction: "desc", value: (standing) => standing.goalsFor },
    { direction: "desc", value: (standing) => standing.fairPlayPoints },
    {
      direction: "asc",
      value: (standing) => standing.fifaRankingCurrent,
    },
  ];
}

function rankSamePointsBucket(
  bucket: ComputedGroupStanding[],
  groupMatches: GroupMatch[],
) {
  const firstHeadToHead = applyCriteria([bucket], headToHeadCriteria(bucket, groupMatches));
  const repeatedHeadToHead = firstHeadToHead.flatMap((remainingBucket) =>
    remainingBucket.length > 1
      ? applyCriteria([remainingBucket], headToHeadCriteria(remainingBucket, groupMatches))
      : [remainingBucket],
  );

  return repeatedHeadToHead.flatMap((remainingBucket) =>
    remainingBucket.length > 1
      ? applyCriteria([remainingBucket], allGroupCriteria())
      : [remainingBucket],
  );
}

export function computeGroupProgression(
  groupName: string,
  teams: TeamSeed[],
  matches: GroupMatch[],
): GroupProgression {
  const standingsByTeamId = new Map(teams.map((team) => [team.id, blankStanding(team)]));
  const groupMatches = matches.filter((match) => match.groupName === groupName);
  const complete = groupMatches.length === 6 && groupMatches.every(finishedWithScore);

  for (const match of groupMatches) {
    if (
      !finishedWithScore(match) ||
      !match.homeTeamId ||
      !match.awayTeamId ||
      !standingsByTeamId.has(match.homeTeamId) ||
      !standingsByTeamId.has(match.awayTeamId)
    ) {
      continue;
    }

    addMatchToStanding(
      standingsByTeamId.get(match.homeTeamId) as ComputedGroupStanding,
      match.homeGoals as number,
      match.awayGoals as number,
    );
    addMatchToStanding(
      standingsByTeamId.get(match.awayTeamId) as ComputedGroupStanding,
      match.awayGoals as number,
      match.homeGoals as number,
    );
  }

  const pointsBuckets = splitBucketByCriterion(
    [...standingsByTeamId.values()].sort(compareSeedOrder),
    { direction: "desc", value: (standing) => standing.points },
  );
  const rankedBuckets = pointsBuckets.flatMap((bucket) =>
    bucket.length > 1 ? rankSamePointsBucket(bucket, groupMatches) : [bucket],
  );
  const unresolvedRanks = new Set<number>();
  const ranked = rankedBuckets.flatMap((bucket, bucketIndex) => {
    const sortedBucket = [...bucket].sort(compareSeedOrder);
    const previousCount = rankedBuckets
      .slice(0, bucketIndex)
      .reduce((sum, previousBucket) => sum + previousBucket.length, 0);

    if (bucket.length > 1) {
      sortedBucket.forEach((_, index) => unresolvedRanks.add(previousCount + index + 1));
    }

    return sortedBucket;
  });

  ranked.forEach((standing, index) => {
    standing.rank = index + 1;
    standing.rankUnresolved = unresolvedRanks.has(standing.rank);
  });

  return {
    complete,
    groupLetter: groupLetterFromName(groupName),
    groupName,
    standings: ranked,
    unresolvedRanks,
  };
}

function thirdPlaceCriteria(): RankCriterion<ComputedGroupStanding>[] {
  return [
    { direction: "desc", value: (standing) => standing.points },
    { direction: "desc", value: (standing) => standing.goalDifference },
    { direction: "desc", value: (standing) => standing.goalsFor },
    { direction: "desc", value: (standing) => standing.fairPlayPoints },
    { direction: "asc", value: (standing) => standing.fifaRankingCurrent },
  ];
}

function computeBestThirdPlaceGroups(groupProgressions: GroupProgression[]) {
  if (
    groupProgressions.length !== 12 ||
    groupProgressions.some((group) => !group.complete || group.unresolvedRanks.has(3))
  ) {
    return { groupLetters: [] as string[], teamIds: new Set<string>(), ready: false };
  }

  const thirdPlaceTeams = groupProgressions
    .map((group) => group.standings.find((standing) => standing.rank === 3))
    .filter((standing): standing is ComputedGroupStanding => Boolean(standing));

  if (thirdPlaceTeams.length !== 12) {
    return { groupLetters: [] as string[], teamIds: new Set<string>(), ready: false };
  }

  const buckets = applyCriteria([thirdPlaceTeams], thirdPlaceCriteria());
  let rankStart = 1;
  const groupLetters: string[] = [];
  const teamIds = new Set<string>();

  for (const bucket of buckets) {
    const rankEnd = rankStart + bucket.length - 1;

    if (rankStart <= 8 && rankEnd > 8) {
      return { groupLetters: [] as string[], teamIds: new Set<string>(), ready: false };
    }

    if (rankEnd <= 8) {
      for (const standing of bucket) {
        groupLetters.push(groupLetterFromName(standing.groupName));
        teamIds.add(standing.teamId);
      }
    }

    rankStart = rankEnd + 1;
  }

  return { groupLetters: groupLetters.sort(), teamIds, ready: true };
}

function updateQualificationStatuses(groupProgressions: GroupProgression[]) {
  const bestThird = computeBestThirdPlaceGroups(groupProgressions);

  for (const group of groupProgressions) {
    for (const standing of group.standings) {
      if (!group.complete) {
        standing.qualificationStatus = "unknown";
      } else if (standing.rank <= 2) {
        standing.qualificationStatus = "qualified_top_two";
      } else if (standing.rank === 3 && bestThird.ready && bestThird.teamIds.has(standing.teamId)) {
        standing.qualificationStatus = "qualified_third_place";
      } else if (standing.rank === 3 && !bestThird.ready) {
        standing.qualificationStatus = "unknown";
      } else {
        standing.qualificationStatus = "eliminated";
      }
    }
  }

  return bestThird;
}

async function writeGroupStandings(
  client: ProgressionClient,
  groupProgressions: GroupProgression[],
  now: Date,
) {
  let updated = 0;

  for (const group of groupProgressions) {
    await client.groupStanding.updateMany({
      where: { groupName: group.groupName },
      data: { rank: { increment: 1000 } },
    });

    for (const standing of group.standings) {
      await client.groupStanding.upsert({
        where: {
          groupName_teamId: {
            groupName: standing.groupName,
            teamId: standing.teamId,
          },
        },
        update: {
          providerSource: progressionSource,
          providerId: `${standing.groupName}-${standing.providerId}`,
          rank: standing.rank,
          played: standing.played,
          wins: standing.wins,
          draws: standing.draws,
          losses: standing.losses,
          goalsFor: standing.goalsFor,
          goalsAgainst: standing.goalsAgainst,
          goalDifference: standing.goalDifference,
          points: standing.points,
          fairPlayPoints: standing.fairPlayPoints,
          fifaRankingCurrent: standing.fifaRankingCurrent,
          qualificationStatus: standing.qualificationStatus,
          rawProviderPayload: asJson({
            complete: group.complete,
            rankUnresolved: standing.rankUnresolved,
            source: progressionSource,
          }),
          lastSyncedAt: now,
        },
        create: {
          providerSource: progressionSource,
          providerId: `${standing.groupName}-${standing.providerId}`,
          groupName: standing.groupName,
          teamId: standing.teamId,
          rank: standing.rank,
          played: standing.played,
          wins: standing.wins,
          draws: standing.draws,
          losses: standing.losses,
          goalsFor: standing.goalsFor,
          goalsAgainst: standing.goalsAgainst,
          goalDifference: standing.goalDifference,
          points: standing.points,
          fairPlayPoints: standing.fairPlayPoints,
          fifaRankingCurrent: standing.fifaRankingCurrent,
          qualificationStatus: standing.qualificationStatus,
          rawProviderPayload: asJson({
            complete: group.complete,
            rankUnresolved: standing.rankUnresolved,
            source: progressionSource,
          }),
          lastSyncedAt: now,
        },
      });
      updated += 1;
    }
  }

  return updated;
}

function resolveRankedTeamId(
  groupByLetter: Map<string, GroupProgression>,
  groupLetter: string,
  rank: number,
) {
  const group = groupByLetter.get(groupLetter);

  if (!group?.complete || group.unresolvedRanks.has(rank)) {
    return null;
  }

  return group.standings.find((standing) => standing.rank === rank)?.teamId ?? null;
}

function parseRankSlotLabel(slotLabel: string) {
  const match = slotLabel.match(/^([12])([A-L])$/);

  if (!match) {
    return null;
  }

  return { rank: Number(match[1]), groupLetter: match[2] };
}

function firstPlaceSlotInMatch(slotLabels: string[]) {
  return slotLabels.find((slotLabel): slotLabel is ThirdPlacePairingSlot =>
    thirdPlacePairingSlots.includes(slotLabel as ThirdPlacePairingSlot),
  ) ?? null;
}

function resolveThirdPlaceSlotTeamId({
  groupByLetter,
  pairing,
  slotLabel,
  slotLabels,
}: {
  groupByLetter: Map<string, GroupProgression>;
  pairing: Record<ThirdPlacePairingSlot, string> | null;
  slotLabel: string;
  slotLabels: string[];
}) {
  if (!pairing || !/^3[A-L](?:\/[A-L])+$/.test(slotLabel)) {
    return null;
  }

  const pairedWinnerSlot = firstPlaceSlotInMatch(slotLabels);

  if (!pairedWinnerSlot) {
    return null;
  }

  const groupLetter = pairing[pairedWinnerSlot];
  const allowedGroups = new Set(slotLabel.replace(/^3/, "").split("/"));

  if (!allowedGroups.has(groupLetter)) {
    return null;
  }

  return resolveRankedTeamId(groupByLetter, groupLetter, 3);
}

function resolveSlotTeamId({
  groupByLetter,
  pairing,
  slotLabel,
  slotLabels,
}: {
  groupByLetter: Map<string, GroupProgression>;
  pairing: Record<ThirdPlacePairingSlot, string> | null;
  slotLabel: string;
  slotLabels: string[];
}) {
  const rankSlot = parseRankSlotLabel(slotLabel);

  if (rankSlot) {
    return resolveRankedTeamId(groupByLetter, rankSlot.groupLetter, rankSlot.rank);
  }

  return resolveThirdPlaceSlotTeamId({ groupByLetter, pairing, slotLabel, slotLabels });
}

async function writeRoundOf32Fixtures({
  client,
  groupProgressions,
  qualifiedThirdGroupLetters,
  now,
}: {
  client: ProgressionClient;
  groupProgressions: GroupProgression[];
  qualifiedThirdGroupLetters: string[];
  now: Date;
}) {
  const groupByLetter = new Map(groupProgressions.map((group) => [group.groupLetter, group]));
  const pairing = getThirdPlacePairing(qualifiedThirdGroupLetters);
  const roundOf32Matches = await client.match.findMany({
    where: { phase: "round_of_32" },
    include: {
      knockoutSlots: true,
    },
    orderBy: { matchNumber: "asc" },
  });
  let resolvedRoundOf32Slots = 0;
  let unresolvedRoundOf32Slots = 0;

  for (const match of roundOf32Matches) {
    const slotLabels = match.knockoutSlots.map((slot) => slot.slotLabel);
    const matchUpdate: Prisma.MatchUpdateInput = {};

    for (const slot of match.knockoutSlots) {
      const resolvedTeamId = resolveSlotTeamId({
        groupByLetter,
        pairing,
        slotLabel: slot.slotLabel,
        slotLabels,
      });
      const resolved = Boolean(resolvedTeamId);

      await client.knockoutSlot.update({
        where: { id: slot.id },
        data: {
          resolvedAt: resolved ? now : null,
          resolvedTeamId,
          source: resolved ? progressionSource : slot.source,
          rawProviderPayload: asJson({
            qualifiedThirdGroupLetters,
            source: progressionSource,
            slotLabel: slot.slotLabel,
          }),
        },
      });

      if (slot.side === "home") {
        matchUpdate.homeTeam = resolvedTeamId ? { connect: { id: resolvedTeamId } } : { disconnect: true };
        matchUpdate.homePlaceholder = resolved ? null : slot.slotLabel;
      } else {
        matchUpdate.awayTeam = resolvedTeamId ? { connect: { id: resolvedTeamId } } : { disconnect: true };
        matchUpdate.awayPlaceholder = resolved ? null : slot.slotLabel;
      }

      if (resolved) {
        resolvedRoundOf32Slots += 1;
      } else {
        unresolvedRoundOf32Slots += 1;
      }
    }

    if (Object.keys(matchUpdate).length > 0) {
      await client.match.update({
        where: { id: match.id },
        data: matchUpdate,
      });
    }
  }

  return { resolvedRoundOf32Slots, unresolvedRoundOf32Slots };
}

async function computeTournamentProgression(client: ProgressionClient) {
  const [teams, existingStandings, groupMatches] = await Promise.all([
    client.team.findMany({
      where: { groupName: { not: null } },
      orderBy: [{ groupName: "asc" }, { nameEn: "asc" }],
    }),
    client.groupStanding.findMany(),
    client.match.findMany({
      where: { phase: "group", publicationStatus: "published" },
      select: {
        awayGoals: true,
        awayTeamId: true,
        groupName: true,
        homeGoals: true,
        homeTeamId: true,
        status: true,
      },
    }),
  ]);
  const existingStandingByTeamId = new Map(existingStandings.map((standing) => [standing.teamId, standing]));
  const teamsByGroup = new Map<string, TeamSeed[]>();

  for (const team of teams) {
    if (!team.groupName) {
      continue;
    }

    const existingStanding = existingStandingByTeamId.get(team.id);
    const groupTeams = teamsByGroup.get(team.groupName) ?? [];
    groupTeams.push({
      id: team.id,
      providerId: team.providerId,
      nameEn: team.nameEn,
      groupName: team.groupName,
      fairPlayPoints: existingStanding?.fairPlayPoints ?? null,
      fifaRankingCurrent: existingStanding?.fifaRankingCurrent ?? null,
    });
    teamsByGroup.set(team.groupName, groupTeams);
  }

  return groupLetters
    .map((letter) => `Grupo ${letter}`)
    .filter((groupName) => teamsByGroup.has(groupName))
    .map((groupName) =>
      computeGroupProgression(
        groupName,
        teamsByGroup.get(groupName) as TeamSeed[],
        groupMatches,
      ),
    );
}

export async function syncTournamentProgression(client: ProgressionClient = prisma) {
  return withProviderSyncLog<TournamentProgressionResult>(
    progressionSource,
    "tournament_progression",
    async () => {
      const now = new Date();
      const groupProgressions = await computeTournamentProgression(client);
      const bestThird = updateQualificationStatuses(groupProgressions);
      const standingsUpdated = await writeGroupStandings(client, groupProgressions, now);
      const { resolvedRoundOf32Slots, unresolvedRoundOf32Slots } = await writeRoundOf32Fixtures({
        client,
        groupProgressions,
        qualifiedThirdGroupLetters: bestThird.ready ? bestThird.groupLetters : [],
        now,
      });
      const result = {
        bestThirdPlaceGroups: bestThird.ready ? bestThird.groupLetters : [],
        completeGroups: groupProgressions.filter((group) => group.complete).length,
        resolvedRoundOf32Slots,
        standingsUpdated,
        unresolvedRoundOf32Slots,
      };

      return {
        result,
        status: groupProgressions.length === 0 ? "skipped" as const : "success" as const,
        metadata: asJson(result),
      };
    },
    client,
  );
}
