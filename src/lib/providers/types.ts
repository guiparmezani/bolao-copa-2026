import type { MatchPhase, MatchStatus } from "@prisma/client";

export type NormalizedTeam = {
  providerSource: string;
  providerId: string;
  fifaCode?: string | null;
  iso2Code?: string | null;
  nameEn: string;
  namePt: string;
  flagEmoji: string;
  groupName?: string | null;
  raw?: unknown;
};

export type NormalizedMatchScore = {
  homeGoals: number;
  awayGoals: number;
  homeGoalsFullTime?: number | null;
  awayGoalsFullTime?: number | null;
  homeGoalsExtraTime?: number | null;
  awayGoalsExtraTime?: number | null;
  homePenalties?: number | null;
  awayPenalties?: number | null;
  winnerTeamProviderId?: string | null;
};

export type NormalizedMatch = {
  providerSource: string;
  providerId: string;
  matchNumber: number;
  phase: MatchPhase;
  groupName?: string | null;
  kickoffAt: Date;
  venueName?: string | null;
  venueCity?: string | null;
  homeTeamProviderId?: string | null;
  awayTeamProviderId?: string | null;
  homePlaceholder?: string | null;
  awayPlaceholder?: string | null;
  status: MatchStatus;
  score?: NormalizedMatchScore | null;
  raw: unknown;
};

export type NormalizedStanding = {
  providerSource: string;
  providerId?: string | null;
  groupName: string;
  teamProviderId: string;
  rank: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  raw?: unknown;
};

export type StaticTournamentData = {
  teams: NormalizedTeam[];
  matches: NormalizedMatch[];
};

export interface TournamentDataProvider {
  source: string;
  fetchStaticTournamentData(): Promise<StaticTournamentData>;
  fetchLiveMatches?(): Promise<NormalizedMatch[]>;
  fetchOfficialStandings?(): Promise<NormalizedStanding[]>;
}
