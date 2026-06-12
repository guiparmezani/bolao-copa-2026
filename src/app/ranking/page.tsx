import type { Match, Prisma } from "@prisma/client";

import { UserIdentity } from "@/components/user-avatar";
import { prisma } from "@/lib/prisma";
import { getPlacementBonuses } from "@/lib/rules";

export const dynamic = "force-dynamic";

type MatchWithTeams = Pick<
  Match,
  "awayGoals" | "awayTeamId" | "homeGoals" | "homeTeamId" | "winnerTeamId"
>;

type RankingRow = {
  avatarImageDataUrl: string | null;
  displayName: string;
  exactCount: number;
  exactPoints: number;
  oneTeamGoalsCount: number;
  oneTeamGoalsPoints: number;
  outcomeCount: number;
  outcomePoints: number;
  placementPoints: number;
  rank: number;
  scoredMatches: number;
  totalPoints: number;
  userId: string;
};

function decimalToNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === "number" ? value : value.toNumber();
}

function formatPoints(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value);
}

function formatUpdatedAt(value: Date | null) {
  if (!value) {
    return "Aguardando pontuação";
  }

  return `Atualizado em ${new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(value)}`;
}

function getWinnerTeamId(match: MatchWithTeams | null) {
  if (!match) {
    return null;
  }

  if (match.winnerTeamId) {
    return match.winnerTeamId;
  }

  if (match.homeGoals === null || match.awayGoals === null || match.homeGoals === match.awayGoals) {
    return null;
  }

  return match.homeGoals > match.awayGoals ? match.homeTeamId : match.awayTeamId;
}

function getFinalRunnerUpTeamId(match: MatchWithTeams | null) {
  const winnerTeamId = getWinnerTeamId(match);

  if (!winnerTeamId || !match) {
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

async function getPlacementPointsByUser() {
  const [bonuses, finalMatch, thirdPlaceMatch, placementPredictions] = await Promise.all([
    getPlacementBonuses(),
    prisma.match.findFirst({
      where: {
        awayGoals: { not: null },
        homeGoals: { not: null },
        phase: "final",
        status: "finished",
      },
    }),
    prisma.match.findFirst({
      where: {
        awayGoals: { not: null },
        homeGoals: { not: null },
        phase: "third_place",
        status: "finished",
      },
    }),
    prisma.placementPrediction.findMany({
      where: {
        confirmedAt: { not: null },
        submission: {
          status: "confirmed",
        },
      },
    }),
  ]);

  const actualTeamByPlacement = {
    champion: getWinnerTeamId(finalMatch),
    runner_up: getFinalRunnerUpTeamId(finalMatch),
    third_place: getWinnerTeamId(thirdPlaceMatch),
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

function groupCountMap(groups: Array<{ _count: { _all: number }; userId: string }>) {
  return new Map(groups.map((group) => [group.userId, group._count._all]));
}

function compareRows(a: Omit<RankingRow, "rank">, b: Omit<RankingRow, "rank">) {
  return (
    b.totalPoints - a.totalPoints ||
    b.exactCount - a.exactCount ||
    b.outcomeCount - a.outcomeCount ||
    b.oneTeamGoalsCount - a.oneTeamGoalsCount ||
    a.displayName.localeCompare(b.displayName, "pt-BR")
  );
}

function isSameScore(a: Omit<RankingRow, "rank">, b: Omit<RankingRow, "rank">) {
  return (
    a.totalPoints === b.totalPoints &&
    a.exactCount === b.exactCount &&
    a.outcomeCount === b.outcomeCount &&
    a.oneTeamGoalsCount === b.oneTeamGoalsCount
  );
}

async function getRankingRows() {
  const [
    activeUsers,
    scoreGroups,
    exactGroups,
    outcomeGroups,
    oneTeamGoalGroups,
    placementPointsByUser,
  ] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      select: {
        avatarImageDataUrl: true,
        displayName: true,
        id: true,
      },
      where: {
        role: "player",
        status: "active",
      },
    }),
    prisma.matchPredictionScore.groupBy({
      by: ["userId"],
      _count: {
        _all: true,
      },
      _sum: {
        oneTeamGoalsPoints: true,
        outcomePoints: true,
        scorelinePoints: true,
        totalPoints: true,
      },
    }),
    prisma.matchPredictionScore.groupBy({
      by: ["userId"],
      _count: {
        _all: true,
      },
      where: {
        isExact: true,
      },
    }),
    prisma.matchPredictionScore.groupBy({
      by: ["userId"],
      _count: {
        _all: true,
      },
      where: {
        isOutcomeCorrect: true,
      },
    }),
    prisma.matchPredictionScore.groupBy({
      by: ["userId"],
      _count: {
        _all: true,
      },
      where: {
        isOneTeamGoalsCorrect: true,
      },
    }),
    getPlacementPointsByUser(),
  ]);

  const scoreByUser = new Map(scoreGroups.map((group) => [group.userId, group]));
  const exactCountByUser = groupCountMap(exactGroups);
  const outcomeCountByUser = groupCountMap(outcomeGroups);
  const oneTeamGoalCountByUser = groupCountMap(oneTeamGoalGroups);
  const rowsWithoutRank = activeUsers.map((user) => {
    const scores = scoreByUser.get(user.id);
    const placementPoints = placementPointsByUser.get(user.id) ?? 0;
    const matchPoints = decimalToNumber(scores?._sum.totalPoints);

    return {
      avatarImageDataUrl: user.avatarImageDataUrl,
      displayName: user.displayName,
      exactCount: exactCountByUser.get(user.id) ?? 0,
      exactPoints: decimalToNumber(scores?._sum.scorelinePoints),
      oneTeamGoalsCount: oneTeamGoalCountByUser.get(user.id) ?? 0,
      oneTeamGoalsPoints: decimalToNumber(scores?._sum.oneTeamGoalsPoints),
      outcomeCount: outcomeCountByUser.get(user.id) ?? 0,
      outcomePoints: decimalToNumber(scores?._sum.outcomePoints),
      placementPoints,
      scoredMatches: scores?._count._all ?? 0,
      totalPoints: matchPoints + placementPoints,
      userId: user.id,
    };
  });
  const sortedRows = rowsWithoutRank.sort(compareRows);
  const rankedRows: RankingRow[] = [];

  for (const [index, row] of sortedRows.entries()) {
    const previousRow = sortedRows[index - 1];
    const previousRank = rankedRows[index - 1]?.rank ?? index + 1;

    rankedRows.push({
      ...row,
      rank: previousRow && isSameScore(row, previousRow) ? previousRank : index + 1,
    });
  }

  return rankedRows;
}

export default async function RankingPage() {
  const [rows, latestLeaderboard] = await Promise.all([
    getRankingRows(),
    prisma.leaderboardSnapshot.findFirst({
      orderBy: {
        computedAt: "desc",
      },
      select: {
        computedAt: true,
      },
    }),
  ]);

  return (
    <main className="band">
      <section className="matches-header">
        <div>
          <span className="chip">Classificação</span>
          <h1>Ranking</h1>
          <p>
            Pontuação detalhada por jogador, separando os pontos por método de
            acerto e somando tudo na coluna final.
          </p>
        </div>
        <div className="match-count">
          <strong>{rows.length}</strong>
          <span>jogadores</span>
        </div>
      </section>

      <section className="card ranking-card" aria-labelledby="ranking-table-title">
        <div className="card-head">
          <div>
            <h2 id="ranking-table-title">Ranking geral</h2>
            <span className="meta">{formatUpdatedAt(latestLeaderboard?.computedAt ?? null)}</span>
          </div>
          <span className="meta">Horário de Brasília</span>
        </div>

        {rows.length === 0 ? (
          <div className="empty-state">
            <strong>Ranking ainda vazio</strong>
            <span>Quando houver jogadores ativos, a classificação aparece aqui.</span>
          </div>
        ) : (
          <div className="ranking-table-wrap">
            <table className="ranking-table">
              <thead>
                <tr>
                  <th scope="col">Pos.</th>
                  <th scope="col">Jogador</th>
                  <th scope="col">Gol de um time</th>
                  <th scope="col">Resultado</th>
                  <th scope="col">Placar exato</th>
                  <th scope="col">Campeões</th>
                  <th scope="col">Jogos</th>
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.userId}>
                    <td className="ranking-position">{row.rank}</td>
                    <th className="ranking-player" scope="row">
                      <UserIdentity user={row} />
                    </th>
                    <td>
                      <strong>{formatPoints(row.oneTeamGoalsPoints)}</strong>
                    </td>
                    <td>
                      <strong>{formatPoints(row.outcomePoints)}</strong>
                    </td>
                    <td>
                      <strong>{formatPoints(row.exactPoints)}</strong>
                    </td>
                    <td>
                      <strong>{formatPoints(row.placementPoints)}</strong>
                    </td>
                    <td>
                      <strong>{row.scoredMatches}</strong>
                      <span>pontuados</span>
                    </td>
                    <td className="ranking-total">
                      <strong>{formatPoints(row.totalPoints)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
