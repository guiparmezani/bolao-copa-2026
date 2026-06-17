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
  oneTeamGoalsCount: number;
  outcomeCount: number;
  placementCount: number;
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

async function getPlacementResultsByUser() {
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
  const resultsByUser = new Map<string, { count: number; points: number }>();

  for (const prediction of placementPredictions) {
    if (prediction.teamId !== actualTeamByPlacement[prediction.placement]) {
      continue;
    }

    const current = resultsByUser.get(prediction.userId) ?? { count: 0, points: 0 };
    resultsByUser.set(prediction.userId, {
      count: current.count + 1,
      points: current.points + bonuses[prediction.placement],
    });
  }

  return resultsByUser;
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
    pointScoringMatchGroups,
    placementResultsByUser,
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
    prisma.matchPredictionScore.groupBy({
      by: ["userId"],
      _count: {
        _all: true,
      },
      where: {
        totalPoints: {
          gt: 0,
        },
      },
    }),
    getPlacementResultsByUser(),
  ]);

  const scoreByUser = new Map(scoreGroups.map((group) => [group.userId, group]));
  const exactCountByUser = groupCountMap(exactGroups);
  const outcomeCountByUser = groupCountMap(outcomeGroups);
  const oneTeamGoalCountByUser = groupCountMap(oneTeamGoalGroups);
  const pointScoringMatchCountByUser = groupCountMap(pointScoringMatchGroups);
  const rowsWithoutRank = activeUsers.map((user) => {
    const scores = scoreByUser.get(user.id);
    const placementResults = placementResultsByUser.get(user.id) ?? { count: 0, points: 0 };
    const matchPoints = decimalToNumber(scores?._sum.totalPoints);

    return {
      avatarImageDataUrl: user.avatarImageDataUrl,
      displayName: user.displayName,
      exactCount: exactCountByUser.get(user.id) ?? 0,
      oneTeamGoalsCount: oneTeamGoalCountByUser.get(user.id) ?? 0,
      outcomeCount: outcomeCountByUser.get(user.id) ?? 0,
      placementCount: placementResults.count,
      placementPoints: placementResults.points,
      scoredMatches: pointScoringMatchCountByUser.get(user.id) ?? 0,
      totalPoints: matchPoints + placementResults.points,
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
  const [rows, latestLeaderboard, finishedMatchesCount] = await Promise.all([
    getRankingRows(),
    prisma.leaderboardSnapshot.findFirst({
      orderBy: {
        computedAt: "desc",
      },
      select: {
        computedAt: true,
      },
    }),
    prisma.match.count({
      where: {
        awayGoals: { not: null },
        homeGoals: { not: null },
        status: "finished",
      },
    }),
  ]);
  const finishedMatchesLabel = finishedMatchesCount === 1 ? "jogo encerrado" : "jogos encerrados";

  return (
    <main className="band">
      <section className="matches-header">
        <div>
          <h1>Ranking</h1>
          <p>
            Acertos por jogador em cada método de pontuação, com a pontuação
            total somada na coluna final.
          </p>
        </div>
        <div className="match-count">
          <strong>{finishedMatchesCount}</strong>
          <span>{finishedMatchesLabel}</span>
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
              <colgroup>
                <col className="ranking-col-position" />
                <col className="ranking-col-player" />
                <col className="ranking-col-method" />
                <col className="ranking-col-outcome" />
                <col className="ranking-col-method" />
                <col className="ranking-col-method" />
                <col className="ranking-col-usage" />
                <col className="ranking-col-total" />
              </colgroup>
              <thead>
                <tr>
                  <th className="ranking-number-cell" scope="col">Pos.</th>
                  <th scope="col">Jogador</th>
                  <th className="ranking-number-cell" scope="col">Gol de um time</th>
                  <th className="ranking-number-cell" scope="col">G/P/Empate</th>
                  <th className="ranking-number-cell" scope="col">Placar exato</th>
                  <th className="ranking-number-cell" scope="col">Campeões</th>
                  <th className="ranking-number-cell" scope="col">Aproveitamento</th>
                  <th className="ranking-number-cell" scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.userId}>
                    <td className="ranking-position ranking-number-cell">{row.rank}</td>
                    <th className="ranking-player" scope="row">
                      <UserIdentity user={row} />
                    </th>
                    <td className="ranking-number-cell">
                      <strong>{row.oneTeamGoalsCount}</strong>
                    </td>
                    <td className="ranking-number-cell">
                      <strong>{row.outcomeCount}</strong>
                    </td>
                    <td className="ranking-number-cell">
                      <strong>{row.exactCount}</strong>
                    </td>
                    <td className="ranking-number-cell">
                      <strong>{row.placementCount}</strong>
                    </td>
                    <td className="ranking-number-cell">
                      <strong>{row.scoredMatches}</strong>
                      <span>pontuados</span>
                    </td>
                    <td className="ranking-total ranking-number-cell">
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
