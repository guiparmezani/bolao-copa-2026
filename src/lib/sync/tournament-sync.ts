import type { Match, Prisma, PrismaClient } from "@prisma/client";

import { OpenFootballStaticProvider } from "@/lib/providers/openfootball-static";
import type { NormalizedMatch, NormalizedStanding, TournamentDataProvider } from "@/lib/providers/types";
import { prisma } from "@/lib/prisma";
import { recomputeLeaderboard } from "@/lib/leaderboard";
import { withProviderSyncLog } from "@/lib/sync/provider-logs";

type SyncClient = PrismaClient | typeof prisma;

type SyncResult = {
  created: number;
  updated: number;
  skipped: number;
};

type FinalizeResult = {
  finishedMatches: number;
  recomputed: boolean;
  leaderboardRows: number;
};

export function getDefaultTournamentProvider(): TournamentDataProvider {
  return new OpenFootballStaticProvider();
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function resolveTeamIds(
  providerSource: string,
  providerIds: Array<string | null | undefined>,
  client: SyncClient,
) {
  const uniqueProviderIds = [...new Set(providerIds.filter((id): id is string => Boolean(id)))];

  if (uniqueProviderIds.length === 0) {
    return new Map<string, string>();
  }

  const teams = await client.team.findMany({
    where: {
      providerSource,
      providerId: {
        in: uniqueProviderIds,
      },
    },
    select: {
      id: true,
      providerId: true,
    },
  });

  return new Map(teams.map((team) => [team.providerId, team.id]));
}

function winnerTeamIdFor(match: NormalizedMatch, teamByProviderId: Map<string, string>) {
  const winnerProviderId = match.score?.winnerTeamProviderId;

  if (winnerProviderId) {
    return teamByProviderId.get(winnerProviderId) ?? null;
  }

  if (!match.score || match.score.homeGoals === match.score.awayGoals) {
    return null;
  }

  const winnerProviderSide =
    match.score.homeGoals > match.score.awayGoals
      ? match.homeTeamProviderId
      : match.awayTeamProviderId;

  return winnerProviderSide ? teamByProviderId.get(winnerProviderSide) ?? null : null;
}

async function upsertStaticMatches(
  matches: NormalizedMatch[],
  client: SyncClient,
): Promise<SyncResult> {
  const teamByProviderId = await resolveTeamIds(
    matches[0]?.providerSource ?? "openfootball-2026",
    matches.flatMap((match) => [match.homeTeamProviderId, match.awayTeamProviderId]),
    client,
  );
  const now = new Date();
  const result: SyncResult = { created: 0, updated: 0, skipped: 0 };

  for (const match of matches) {
    const existing = await client.match.findUnique({
      where: { matchNumber: match.matchNumber },
      select: { id: true },
    });
    const data = {
      providerSource: match.providerSource,
      providerId: match.providerId,
      phase: match.phase,
      groupName: match.groupName ?? null,
      kickoffAt: match.kickoffAt,
      venueName: match.venueName ?? null,
      venueCity: match.venueCity ?? null,
      homeTeamId: match.homeTeamProviderId
        ? teamByProviderId.get(match.homeTeamProviderId) ?? null
        : null,
      awayTeamId: match.awayTeamProviderId
        ? teamByProviderId.get(match.awayTeamProviderId) ?? null
        : null,
      homePlaceholder: match.homePlaceholder ?? null,
      awayPlaceholder: match.awayPlaceholder ?? null,
      publicationStatus: "published" as const,
      publishedAt: now,
      rawProviderPayload: asJson(match.raw),
      lastSyncedAt: now,
    };
    const savedMatch = await client.match.upsert({
      where: { matchNumber: match.matchNumber },
      update: data,
      create: {
        ...data,
        matchNumber: match.matchNumber,
        status: match.status,
      },
    });

    if (match.homePlaceholder && match.awayPlaceholder) {
      await Promise.all([
        upsertKnockoutSlot(savedMatch.id, "home", match.homePlaceholder, match, client),
        upsertKnockoutSlot(savedMatch.id, "away", match.awayPlaceholder, match, client),
      ]);
    }

    if (existing) {
      result.updated += 1;
    } else {
      result.created += 1;
    }
  }

  return result;
}

async function upsertKnockoutSlot(
  matchId: string,
  side: "home" | "away",
  slotLabel: string,
  match: NormalizedMatch,
  client: SyncClient,
) {
  await client.knockoutSlot.upsert({
    where: {
      matchId_side: {
        matchId,
        side,
      },
    },
    update: {
      slotLabel,
      source: match.providerSource,
      rawProviderPayload: asJson(match.raw),
    },
    create: {
      matchId,
      side,
      slotLabel,
      source: match.providerSource,
      rawProviderPayload: asJson(match.raw),
    },
  });
}

export async function syncStaticTournamentData(
  provider = getDefaultTournamentProvider(),
  client: SyncClient = prisma,
) {
  return withProviderSyncLog(
    provider.source,
    "static_tournament_data",
    async () => {
      const data = await provider.fetchStaticTournamentData();
      const now = new Date();
      const teamResult: SyncResult = { created: 0, updated: 0, skipped: 0 };

      for (const team of data.teams) {
        const existing = await client.team.findUnique({
          where: {
            providerSource_providerId: {
              providerSource: team.providerSource,
              providerId: team.providerId,
            },
          },
          select: { id: true },
        });
        const savedTeam = await client.team.upsert({
          where: {
            providerSource_providerId: {
              providerSource: team.providerSource,
              providerId: team.providerId,
            },
          },
          update: {
            fifaCode: team.fifaCode ?? null,
            iso2Code: team.iso2Code ?? null,
            nameEn: team.nameEn,
            namePt: team.namePt,
            flagEmoji: team.flagEmoji,
            groupName: team.groupName ?? null,
          },
          create: {
            providerSource: team.providerSource,
            providerId: team.providerId,
            fifaCode: team.fifaCode ?? null,
            iso2Code: team.iso2Code ?? null,
            nameEn: team.nameEn,
            namePt: team.namePt,
            flagEmoji: team.flagEmoji,
            groupName: team.groupName ?? null,
          },
        });

        if (team.groupName) {
          await client.groupStanding.upsert({
            where: {
              groupName_teamId: {
                groupName: team.groupName,
                teamId: savedTeam.id,
              },
            },
            update: {
              providerSource: team.providerSource,
              providerId: `${team.groupName}-${team.providerId}`,
              lastSyncedAt: now,
            },
            create: {
              providerSource: team.providerSource,
              providerId: `${team.groupName}-${team.providerId}`,
              groupName: team.groupName,
              teamId: savedTeam.id,
              rank:
                data.teams.filter((candidate) => candidate.groupName === team.groupName)
                  .findIndex((candidate) => candidate.providerId === team.providerId) + 1,
              lastSyncedAt: now,
            },
          });
        }

        if (existing) {
          teamResult.updated += 1;
        } else {
          teamResult.created += 1;
        }
      }

      const matchResult = await upsertStaticMatches(data.matches, client);

      return {
        result: { teams: teamResult, matches: matchResult },
        metadata: asJson({
          teams: data.teams.length,
          matches: data.matches.length,
          teamResult,
          matchResult,
        }),
      };
    },
    client,
  );
}

export async function syncLiveMatches(
  provider = getDefaultTournamentProvider(),
  client: SyncClient = prisma,
) {
  return withProviderSyncLog(
    provider.source,
    "live_matches",
    async () => {
      if (!provider.fetchLiveMatches) {
        return {
          result: { created: 0, updated: 0, skipped: 0 },
          status: "skipped" as const,
          metadata: asJson({ reason: "provider_has_no_live_match_endpoint" }),
        };
      }

      const matches = await provider.fetchLiveMatches();
      const result = await updateMatchesFromProvider(matches, client);
      let finalizeResult: FinalizeResult | null = null;

      if (result.updated > 0) {
        finalizeResult = await finalizeFinishedMatches(client);
      }

      return {
        result,
        metadata: asJson({ matches: matches.length, result, finalizeResult }),
        status: matches.length === 0 ? "skipped" as const : "success" as const,
      };
    },
    client,
  );
}

async function updateMatchesFromProvider(matches: NormalizedMatch[], client: SyncClient) {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0 };
  const teamByProviderId = await resolveTeamIds(
    matches[0]?.providerSource ?? "openfootball-2026",
    matches.flatMap((match) => [
      match.homeTeamProviderId,
      match.awayTeamProviderId,
      match.score?.winnerTeamProviderId,
    ]),
    client,
  );
  const now = new Date();

  for (const match of matches) {
    const existing = await client.match.findUnique({
      where: {
        providerSource_providerId: {
          providerSource: match.providerSource,
          providerId: match.providerId,
        },
      },
    });

    if (!existing) {
      result.skipped += 1;
      continue;
    }

    if (existing.manualOverrideByUserId || existing.manualOverrideAt) {
      result.skipped += 1;
      continue;
    }

    await client.match.update({
      where: { id: existing.id },
      data: liveMatchUpdateData(match, teamByProviderId, now),
    });
    result.updated += 1;
  }

  return result;
}

function liveMatchUpdateData(
  match: NormalizedMatch,
  teamByProviderId: Map<string, string>,
  now: Date,
): Prisma.MatchUpdateInput {
  const homeTeamId = match.homeTeamProviderId
    ? teamByProviderId.get(match.homeTeamProviderId)
    : null;
  const awayTeamId = match.awayTeamProviderId
    ? teamByProviderId.get(match.awayTeamProviderId)
    : null;
  const winnerTeamId = winnerTeamIdFor(match, teamByProviderId);

  return {
    status: match.status,
    homeTeam: homeTeamId ? { connect: { id: homeTeamId } } : undefined,
    awayTeam: awayTeamId ? { connect: { id: awayTeamId } } : undefined,
    homePlaceholder: match.homePlaceholder ?? undefined,
    awayPlaceholder: match.awayPlaceholder ?? undefined,
    homeGoals: match.score?.homeGoals,
    awayGoals: match.score?.awayGoals,
    homeGoalsFullTime: match.score?.homeGoalsFullTime,
    awayGoalsFullTime: match.score?.awayGoalsFullTime,
    homeGoalsExtraTime: match.score?.homeGoalsExtraTime,
    awayGoalsExtraTime: match.score?.awayGoalsExtraTime,
    homePenalties: match.score?.homePenalties,
    awayPenalties: match.score?.awayPenalties,
    winnerTeam: match.score
      ? winnerTeamId
        ? { connect: { id: winnerTeamId } }
        : { disconnect: true }
      : undefined,
    rawProviderPayload: asJson(match.raw),
    lastSyncedAt: now,
  };
}

export async function finalizeFinishedMatches(client: SyncClient = prisma): Promise<FinalizeResult> {
  return withProviderSyncLog<FinalizeResult>(
    "local-worker",
    "finalize_finished_matches",
    async () => {
      const finishedMatches = await client.match.count({
        where: {
          status: "finished",
          homeGoals: { not: null },
          awayGoals: { not: null },
        },
      });

      if (finishedMatches === 0) {
        return {
          result: { finishedMatches, recomputed: false, leaderboardRows: 0 },
          status: "skipped" as const,
          metadata: asJson({ finishedMatches }),
        };
      }

      const leaderboard = await recomputeLeaderboard(client);

      return {
        result: {
          finishedMatches,
          recomputed: true,
          leaderboardRows: leaderboard.leaderboardRows,
        },
        metadata: asJson({ finishedMatches, leaderboard }),
      };
    },
    client,
  );
}

export async function openKnockoutPredictionsIfReady(client: SyncClient = prisma) {
  return withProviderSyncLog<{
    opened: boolean;
    openedAt?: string;
    checkedMatches: number;
  }>(
    "local-worker",
    "open_knockout_predictions_if_ready",
    async () => {
      const roundOf32Matches = await client.match.findMany({
        where: { phase: "round_of_32" },
        select: {
          id: true,
          homeTeamId: true,
          awayTeamId: true,
          homePlaceholder: true,
          awayPlaceholder: true,
        },
      });
      const ready =
        roundOf32Matches.length === 16 &&
        roundOf32Matches.every((match) =>
          Boolean(match.homeTeamId && match.awayTeamId && !match.homePlaceholder && !match.awayPlaceholder),
        );

      if (!ready) {
        return {
          result: { opened: false, checkedMatches: roundOf32Matches.length },
          status: "skipped" as const,
          metadata: asJson({ ready, checkedMatches: roundOf32Matches.length }),
        };
      }

      const existing = await client.appSetting.findUnique({
        where: { key: "knockout_submission_open_at" },
      });
      const openedAt =
        typeof existing?.value === "string" ? existing.value : new Date().toISOString();

      await client.appSetting.upsert({
        where: { key: "knockout_submission_open_at" },
        update: { value: openedAt },
        create: { key: "knockout_submission_open_at", value: openedAt },
      });
      await client.appSetting.upsert({
        where: { key: "knockout_predictions_enabled" },
        update: { value: true },
        create: { key: "knockout_predictions_enabled", value: true },
      });

      return {
        result: { opened: true, openedAt, checkedMatches: roundOf32Matches.length },
        metadata: asJson({ ready, openedAt, checkedMatches: roundOf32Matches.length }),
      };
    },
    client,
  );
}

export async function syncOfficialStandings(
  provider = getDefaultTournamentProvider(),
  client: SyncClient = prisma,
) {
  return withProviderSyncLog(
    provider.source,
    "official_standings",
    async () => {
      if (!provider.fetchOfficialStandings) {
        return {
          result: { created: 0, updated: 0, skipped: 0 },
          status: "skipped" as const,
          metadata: asJson({ reason: "provider_has_no_standings_endpoint" }),
        };
      }

      const standings = await provider.fetchOfficialStandings();
      const result = await upsertOfficialStandings(standings, client);

      return {
        result,
        status: standings.length === 0 ? "skipped" as const : "success" as const,
        metadata: asJson({ standings: standings.length, result }),
      };
    },
    client,
  );
}

async function upsertOfficialStandings(
  standings: NormalizedStanding[],
  client: SyncClient,
): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0 };
  const teamByProviderId = await resolveTeamIds(
    standings[0]?.providerSource ?? "openfootball-2026",
    standings.map((standing) => standing.teamProviderId),
    client,
  );
  const now = new Date();

  for (const standing of standings) {
    const teamId = teamByProviderId.get(standing.teamProviderId);

    if (!teamId) {
      result.skipped += 1;
      continue;
    }

    const existing = await client.groupStanding.findUnique({
      where: {
        groupName_teamId: {
          groupName: standing.groupName,
          teamId,
        },
      },
      select: { id: true },
    });

    await client.groupStanding.upsert({
      where: {
        groupName_teamId: {
          groupName: standing.groupName,
          teamId,
        },
      },
      update: {
        providerSource: standing.providerSource,
        providerId: standing.providerId ?? null,
        rank: standing.rank,
        played: standing.played,
        wins: standing.wins,
        draws: standing.draws,
        losses: standing.losses,
        goalsFor: standing.goalsFor,
        goalsAgainst: standing.goalsAgainst,
        goalDifference: standing.goalDifference,
        points: standing.points,
        rawProviderPayload: standing.raw ? asJson(standing.raw) : undefined,
        lastSyncedAt: now,
      },
      create: {
        providerSource: standing.providerSource,
        providerId: standing.providerId ?? null,
        groupName: standing.groupName,
        teamId,
        rank: standing.rank,
        played: standing.played,
        wins: standing.wins,
        draws: standing.draws,
        losses: standing.losses,
        goalsFor: standing.goalsFor,
        goalsAgainst: standing.goalsAgainst,
        goalDifference: standing.goalDifference,
        points: standing.points,
        rawProviderPayload: standing.raw ? asJson(standing.raw) : undefined,
        lastSyncedAt: now,
      },
    });

    if (existing) {
      result.updated += 1;
    } else {
      result.created += 1;
    }
  }

  return result;
}

export type { Match };
