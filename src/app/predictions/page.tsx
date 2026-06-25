import type { PlacementPredictionKind } from "@prisma/client";
import Link from "next/link";

import { PlayerSidebar } from "@/components/app-frame";
import { TeamLabel } from "@/components/team-flag";
import { UserIdentity } from "@/components/user-avatar";
import { getCurrentUser } from "@/lib/auth/session";
import { placementLabels } from "@/lib/predictions/placement";
import { prisma } from "@/lib/prisma";
import { brazilTimeZone, formatBrazilTime, phaseLabels } from "@/lib/tournament";

export const dynamic = "force-dynamic";

type PredictionsPageProps = {
  searchParams?: Promise<{ aba?: string; jogo?: string; usuario?: string }>;
};

async function getPredictionUsers() {
  return prisma.user.findMany({
    where: {
      role: "player",
      status: "active",
    },
    select: {
      avatarImageDataUrl: true,
      displayName: true,
      id: true,
    },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
  });
}

async function getPublishedPredictionMatches() {
  return prisma.match.findMany({
    where: {
      publicationStatus: "published",
    },
    include: {
      awayTeam: true,
      homeTeam: true,
    },
    orderBy: [{ kickoffAt: "asc" }, { matchNumber: "asc" }],
  });
}

async function getUserPredictionData(userId: string) {
  const [matchPredictions, placementPredictions] = await Promise.all([
    prisma.matchPrediction.findMany({
      where: {
        confirmedAt: {
          not: null,
        },
        userId,
      },
      include: {
        match: {
          include: {
            awayTeam: true,
            homeTeam: true,
          },
        },
      },
      orderBy: [
        {
          match: {
            kickoffAt: "asc",
          },
        },
        {
          match: {
            matchNumber: "asc",
          },
        },
      ],
    }),
    prisma.placementPrediction.findMany({
      where: {
        confirmedAt: {
          not: null,
        },
        submission: {
          status: "confirmed",
        },
        userId,
      },
      include: {
        team: true,
      },
      orderBy: {
        placement: "asc",
      },
    }),
  ]);

  return { matchPredictions, placementPredictions };
}

async function getMatchPredictionScores(matchId: string | null) {
  if (!matchId) {
    return [];
  }

  return prisma.matchPrediction.findMany({
    where: {
      confirmedAt: {
        not: null,
      },
      matchId,
      user: {
        role: "player",
        status: "active",
      },
    },
    select: {
      awayGoals: true,
      homeGoals: true,
      userId: true,
    },
  });
}

async function getPlayerPointTotals(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, number>();
  }

  const rows = await prisma.leaderboardSnapshot.findMany({
    where: {
      userId: {
        in: userIds,
      },
    },
    select: {
      totalPoints: true,
      userId: true,
    },
  });

  return new Map(rows.map((row) => [row.userId, row.totalPoints.toNumber()]));
}

type SubmittedMatchPrediction = Awaited<
  ReturnType<typeof getUserPredictionData>
>["matchPredictions"][number];
type SubmittedPlacementPrediction = Awaited<
  ReturnType<typeof getUserPredictionData>
>["placementPredictions"][number];
type PredictionMatch = Awaited<ReturnType<typeof getPublishedPredictionMatches>>[number];
type PredictionUser = Awaited<ReturnType<typeof getPredictionUsers>>[number];
type PredictionData = Awaited<ReturnType<typeof getUserPredictionData>>;
type MatchPredictionScore = Awaited<ReturnType<typeof getMatchPredictionScores>>[number];
type PredictionTab = "jogos" | "jogadores";

const placementKinds: PlacementPredictionKind[] = ["champion", "runner_up", "third_place"];

function formatCompactBrazilDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: brazilTimeZone,
    year: "numeric",
  }).format(value);
}

function formatPredictionPoints(value: number) {
  const points = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value);

  return `${points} pts`;
}

function teamName(
  team: PredictionMatch["homeTeam"],
  placeholder: string | null,
  flagPosition: "before" | "after",
) {
  if (!team) {
    return placeholder ?? "A definir";
  }

  return <TeamLabel flagPosition={flagPosition} team={team} />;
}

function officialScoreForMatch(match: PredictionMatch) {
  if (match.homeGoals === null || match.awayGoals === null) {
    return "A definir";
  }

  return `${match.homeGoals} x ${match.awayGoals}`;
}

function officialScoreParts(match: PredictionMatch) {
  if (!hasFinalScore(match)) {
    return null;
  }

  return {
    awayGoals: match.awayGoals,
    homeGoals: match.homeGoals,
  };
}

function hasFinalScore(match: PredictionMatch) {
  return match.status === "finished" && match.homeGoals !== null && match.awayGoals !== null;
}

function isAfterTimeline(match: PredictionMatch, previous: PredictionMatch) {
  if (match.kickoffAt.getTime() !== previous.kickoffAt.getTime()) {
    return match.kickoffAt > previous.kickoffAt;
  }

  return match.matchNumber > previous.matchNumber;
}

function getNextResultMatchId(matches: PredictionMatch[], now: Date) {
  const latestFinishedMatch = matches.reduce<PredictionMatch | null>((latest, match) => {
    if (!hasFinalScore(match)) {
      return latest;
    }

    if (!latest || isAfterTimeline(match, latest)) {
      return match;
    }

    return latest;
  }, null);

  const nextMatch = latestFinishedMatch
    ? matches.find((match) => isAfterTimeline(match, latestFinishedMatch) && !hasFinalScore(match))
    : matches.find((match) => match.kickoffAt <= now && !hasFinalScore(match));

  return nextMatch?.id ?? null;
}

function groupMatchesByPhase(matches: PredictionMatch[]) {
  return matches.reduce<Map<string, PredictionMatch[]>>(
    (groups, match) => {
      const current = groups.get(match.phase) ?? [];
      current.push(match);
      groups.set(match.phase, current);
      return groups;
    },
    new Map(),
  );
}

function scoreLabel(prediction: SubmittedMatchPrediction | undefined) {
  if (!prediction) {
    return "—";
  }

  return `${prediction.homeGoals} x ${prediction.awayGoals}`;
}

function placementText(prediction: SubmittedPlacementPrediction | undefined) {
  if (!prediction) {
    return "—";
  }

  return <TeamLabel flagPosition="after" team={prediction.team} />;
}

function selectedTabFromParams(params: { aba?: string; usuario?: string }): PredictionTab {
  if (params.aba === "jogadores" || (!params.aba && params.usuario)) {
    return "jogadores";
  }

  return "jogos";
}

function predictionByMatchId(predictions: SubmittedMatchPrediction[]) {
  return new Map(predictions.map((prediction) => [prediction.matchId, prediction]));
}

function placementByKind(predictions: SubmittedPlacementPrediction[]) {
  return new Map(predictions.map((prediction) => [prediction.placement, prediction]));
}

function scoreFromPrediction(prediction: MatchPredictionScore | undefined) {
  if (!prediction) {
    return "—";
  }

  return `${prediction.homeGoals} x ${prediction.awayGoals}`;
}

function matchPredictionByUserId(predictions: MatchPredictionScore[]) {
  return new Map(predictions.map((prediction) => [prediction.userId, prediction]));
}

function predictionOutcome(prediction: MatchPredictionScore | undefined) {
  if (!prediction) {
    return null;
  }

  if (prediction.homeGoals > prediction.awayGoals) {
    return "home";
  }

  if (prediction.awayGoals > prediction.homeGoals) {
    return "away";
  }

  return "draw";
}

function predictionComparisonLabel({
  currentUserId,
  playerPrediction,
  selfPrediction,
  userId,
}: {
  currentUserId?: string;
  playerPrediction?: MatchPredictionScore;
  selfPrediction?: MatchPredictionScore;
  userId: string;
}) {
  if (!currentUserId || !selfPrediction) {
    return null;
  }

  if (userId === currentUserId) {
    return "Seu palpite";
  }

  if (!playerPrediction) {
    return "Sem palpite";
  }

  if (
    playerPrediction.homeGoals === selfPrediction.homeGoals &&
    playerPrediction.awayGoals === selfPrediction.awayGoals
  ) {
    return "Mesmo placar";
  }

  if (predictionOutcome(playerPrediction) === predictionOutcome(selfPrediction)) {
    return "Mesmo resultado";
  }

  return "Diferente";
}

function predictionComparisonClass(label: string | null) {
  if (label === "Seu palpite" || label === "Mesmo placar") {
    return "is-match";
  }

  if (label === "Mesmo resultado") {
    return "is-result";
  }

  if (label === "Sem palpite") {
    return "is-empty";
  }

  return "is-different";
}

function isExactPredictionForMatch(
  prediction: MatchPredictionScore | undefined,
  match: PredictionMatch,
) {
  return (
    Boolean(prediction) &&
    hasFinalScore(match) &&
    prediction?.homeGoals === match.homeGoals &&
    prediction.awayGoals === match.awayGoals
  );
}

function matchStatusFact(match: PredictionMatch) {
  if (hasFinalScore(match)) {
    return `Resultado final: ${officialScoreForMatch(match)}`;
  }

  if (match.status === "live") {
    return "Em andamento";
  }

  if (match.status === "paused") {
    return "Intervalo";
  }

  if (match.status === "postponed") {
    return "Adiado";
  }

  if (match.status === "cancelled") {
    return "Cancelado";
  }

  return "Resultado pendente";
}

function matchFactText(match: PredictionMatch) {
  const phase = phaseLabels[match.phase as keyof typeof phaseLabels] ?? match.phase;

  return [
    `Jogo ${match.matchNumber}`,
    phase,
    `${formatCompactBrazilDate(match.kickoffAt)}, ${formatBrazilTime(match.kickoffAt)}`,
    matchStatusFact(match),
  ].join(" • ");
}

function matchupLabel(match: PredictionMatch, showFinalScore = false) {
  const finalScore = showFinalScore ? officialScoreParts(match) : null;

  return (
    <>
      <span className="prediction-game-team">
        {teamName(match.homeTeam, match.homePlaceholder, "after")}
      </span>
      {finalScore ? (
        <span
          aria-label={`Resultado ${finalScore.homeGoals} a ${finalScore.awayGoals}`}
          className="prediction-game-score"
        >
          {finalScore.homeGoals} x {finalScore.awayGoals}
        </span>
      ) : (
        <span className="prediction-game-versus">x</span>
      )}
      <span className="prediction-game-team">
        {teamName(match.awayTeam, match.awayPlaceholder, "before")}
      </span>
    </>
  );
}

function PredictionMatchSummary({
  isNextResultMatch = false,
  match,
}: {
  isNextResultMatch?: boolean;
  match: PredictionMatch;
}) {
  return (
    <div className="public-match-summary">
      <span className="public-match-line">
        <strong className="public-match-title">Jogo {match.matchNumber}</strong>
        {isNextResultMatch ? (
          <span className="next-result-badge">Próximo resultado</span>
        ) : null}
        <span className="public-matchup">
          <span className="public-team-name">
            {teamName(match.homeTeam, match.homePlaceholder, "after")}
          </span>
          <span className="public-versus"> x </span>
          <span className="public-team-name">
            {teamName(match.awayTeam, match.awayPlaceholder, "before")}
          </span>
        </span>
      </span>
      <span className="public-match-secondary">
        <span className="public-match-meta">
          {formatCompactBrazilDate(match.kickoffAt)} • {formatBrazilTime(match.kickoffAt)}
        </span>
        <span className="public-result-score">Resultado: {officialScoreForMatch(match)}</span>
      </span>
    </div>
  );
}

function PredictionDetailCard({
  data,
  matches,
  nextResultMatchId,
  totalPoints,
  user,
}: {
  data: PredictionData;
  matches: PredictionMatch[];
  nextResultMatchId: string | null;
  totalPoints: number;
  user: PredictionUser;
}) {
  const groupedMatches = groupMatchesByPhase(matches);
  const predictionsByMatch = predictionByMatchId(data.matchPredictions);
  const placements = placementByKind(data.placementPredictions);

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>
            <UserIdentity avatarSize="md" user={user} />
          </h2>
        </div>
        <span className="meta">{formatPredictionPoints(totalPoints)}</span>
      </div>

      <div className="rules-list">
        {placementKinds.map((placement) => (
          <div className="rules-row compact" key={placement}>
            <strong>{placementLabels[placement]}</strong>
            <span>{placementText(placements.get(placement))}</span>
          </div>
        ))}
      </div>

      {matches.length === 0 ? (
        <div className="empty-state">
          <strong>Nenhum jogo publicado</strong>
          <span>Quando a tabela estiver publicada, os placares aparecem aqui.</span>
        </div>
      ) : (
        Array.from(groupedMatches.entries()).map(([phase, phaseMatches]) => (
          <div className="public-prediction-section" key={phase}>
            <div className="schedule-day-head">
              <h3>{phaseLabels[phase as keyof typeof phaseLabels]}</h3>
              <span className="meta">{phaseMatches.length} jogos</span>
            </div>
            <div className="schedule-day-matches">
              {phaseMatches.map((match) => {
                const prediction = predictionsByMatch.get(match.id);
                const isNextResultMatch = match.id === nextResultMatchId;

                return (
                  <div
                    className={
                      isNextResultMatch
                        ? "comparison-row public-prediction-row next-result-row"
                        : "comparison-row public-prediction-row"
                    }
                    key={match.id}
                  >
                    <PredictionMatchSummary
                      isNextResultMatch={isNextResultMatch}
                      match={match}
                    />
                    <span className="schedule-score">{scoreLabel(prediction)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

function SignedInComparison({
  currentData,
  matches,
  nextResultMatchId,
  selectedData,
  selectedUserPoints,
  selectedUser,
}: {
  currentData: PredictionData;
  matches: PredictionMatch[];
  nextResultMatchId: string | null;
  selectedData: PredictionData;
  selectedUserPoints: number;
  selectedUser: PredictionUser;
}) {
  const currentByMatch = predictionByMatchId(currentData.matchPredictions);
  const selectedByMatch = predictionByMatchId(selectedData.matchPredictions);
  const currentPlacements = placementByKind(currentData.placementPredictions);
  const selectedPlacements = placementByKind(selectedData.placementPredictions);
  const hasPredictions =
    matches.length > 0 ||
    placementKinds.some(
      (placement) => currentPlacements.has(placement) || selectedPlacements.has(placement),
    );

  return (
    <section className="card prediction-comparison-card">
      <div className="card-head">
        <div>
          <h2>
            Você x <UserIdentity avatarSize="md" user={selectedUser} />
          </h2>
          <span className="meta">Comparativo lado a lado</span>
        </div>
        <span className="meta">{formatPredictionPoints(selectedUserPoints)}</span>
      </div>

      {!hasPredictions ? (
        <div className="empty-state">
          <strong>Nenhum palpite confirmado para comparar</strong>
          <span>Quando a tabela estiver publicada, o comparativo aparece aqui.</span>
        </div>
      ) : (
        <>
          <div className="dual-placement-grid" aria-label="Comparativo de campeões">
            <div className="dual-placement-row dual-placement-heading">
              <span>Palpite</span>
              <span className="comparison-lane-heading comparison-cell-current">Você</span>
              <span className="comparison-lane-heading comparison-cell-selected">
                {selectedUser.displayName}
              </span>
            </div>
            {placementKinds.map((placement) => (
              <div className="dual-placement-row" key={placement}>
                <strong>{placementLabels[placement]}</strong>
                <span
                  className="comparison-cell comparison-cell-current"
                  data-player="Você"
                >
                  {placementText(currentPlacements.get(placement))}
                </span>
                <span
                  className="comparison-cell comparison-cell-selected"
                  data-player={selectedUser.displayName}
                >
                  {placementText(selectedPlacements.get(placement))}
                </span>
              </div>
            ))}
          </div>

          <div className="dual-prediction-table" aria-label="Comparativo de placares">
            <div className="dual-prediction-row dual-prediction-heading">
              <span>Jogo</span>
              <span className="comparison-lane-heading comparison-cell-current">Você</span>
              <span className="comparison-lane-heading comparison-cell-selected">
                {selectedUser.displayName}
              </span>
            </div>
            {matches.map((match) => {
              const isNextResultMatch = match.id === nextResultMatchId;

              return (
                <div
                  className={
                    isNextResultMatch
                      ? "dual-prediction-row next-result-row"
                      : "dual-prediction-row"
                  }
                  key={match.id}
                >
                  <PredictionMatchSummary
                    isNextResultMatch={isNextResultMatch}
                    match={match}
                  />
                  <span
                    className="schedule-score comparison-cell comparison-cell-current"
                    data-player="Você"
                  >
                    {scoreLabel(currentByMatch.get(match.id))}
                  </span>
                  <span
                    className="schedule-score comparison-cell comparison-cell-selected"
                    data-player={selectedUser.displayName}
                  >
                    {scoreLabel(selectedByMatch.get(match.id))}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function GamePredictionComparison({
  match,
  predictions,
  signedInPlayer,
  users,
}: {
  match: PredictionMatch | null;
  predictions: MatchPredictionScore[];
  signedInPlayer: PredictionUser | null;
  users: PredictionUser[];
}) {
  const predictionsByUser = matchPredictionByUserId(predictions);
  const selfPrediction = signedInPlayer
    ? predictionsByUser.get(signedInPlayer.id)
    : undefined;

  if (!match) {
    return (
      <article className="card empty-state">
        <strong>Nenhum jogo publicado</strong>
        <span>Quando a tabela estiver publicada, os jogos aparecem aqui.</span>
      </article>
    );
  }

  return (
    <section className="card game-comparison-card">
      <div className="card-head">
        <div>
          <h2 className="prediction-game-heading">{matchupLabel(match, true)}</h2>
          <span className="meta">{matchFactText(match)}</span>
        </div>
        <span className="meta">{users.length} jogadores</span>
      </div>

      {signedInPlayer ? (
        <div className="my-game-prediction">
          <span>Seu palpite</span>
          <strong>{scoreFromPrediction(selfPrediction)}</strong>
        </div>
      ) : null}

      {users.length === 0 ? (
        <div className="empty-state">
          <strong>Nenhum jogador ativo</strong>
          <span>Esta área fica em branco até alguém entrar no bolão.</span>
        </div>
      ) : (
        <div
          className={
            signedInPlayer
              ? "game-prediction-table"
              : "game-prediction-table no-comparison"
          }
          aria-label="Palpites por jogo"
        >
          {users.map((user) => {
            const prediction = predictionsByUser.get(user.id);
            const isExactResult = isExactPredictionForMatch(prediction, match);
            const comparisonLabel = predictionComparisonLabel({
              currentUserId: signedInPlayer?.id,
              playerPrediction: prediction,
              selfPrediction,
              userId: user.id,
            });
            const comparisonClass = predictionComparisonClass(comparisonLabel);
            const rowClassName = [
              "game-prediction-row",
              signedInPlayer?.id === user.id ? "is-current-user" : "",
              isExactResult ? "is-exact-result" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div
                className={rowClassName}
                key={user.id}
              >
                <UserIdentity linkToPredictions={false} user={user} />
                <span className="schedule-score">{scoreFromPrediction(prediction)}</span>
                {signedInPlayer ? (
                  <span className={`prediction-compare-status ${comparisonClass}`}>
                    {comparisonLabel}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default async function PublicPredictionsPage({
  searchParams,
}: PredictionsPageProps) {
  const params = (await searchParams) ?? {};
  const currentUser = await getCurrentUser();
  const signedInPlayer = currentUser?.role === "player" ? currentUser : null;
  const activeTab = selectedTabFromParams(params);
  const [users, matches] = await Promise.all([
    getPredictionUsers(),
    getPublishedPredictionMatches(),
  ]);
  const nextResultMatchId = getNextResultMatchId(matches, new Date());
  const selectedMatch =
    matches.find((match) => match.id === params.jogo) ??
    matches.find((match) => match.id === nextResultMatchId) ??
    matches[0] ??
    null;
  const selectedUser =
    users.find((user) => user.id === params.usuario) ??
    users.find((user) => user.id !== signedInPlayer?.id) ??
    users[0] ??
    null;
  const dataUserIds = [
    ...new Set(
      [selectedUser?.id, signedInPlayer?.id].filter((userId): userId is string =>
        Boolean(userId),
      ),
    ),
  ];
  const [predictionEntries, selectedMatchPredictions, pointTotalsByUserId] = await Promise.all([
    Promise.all(
      dataUserIds.map(async (userId) => [userId, await getUserPredictionData(userId)] as const),
    ),
    getMatchPredictionScores(selectedMatch?.id ?? null),
    getPlayerPointTotals(users.map((user) => user.id)),
  ]);
  const predictionDataByUserId = new Map(predictionEntries);
  const predictionData = selectedUser
    ? predictionDataByUserId.get(selectedUser.id) ?? {
        matchPredictions: [],
        placementPredictions: [],
      }
    : { matchPredictions: [], placementPredictions: [] };
  const signedInPredictionData = signedInPlayer
    ? predictionDataByUserId.get(signedInPlayer.id) ?? {
        matchPredictions: [],
        placementPredictions: [],
      }
    : null;
  const selectedUserPoints = selectedUser
    ? pointTotalsByUserId.get(selectedUser.id) ?? 0
    : 0;

  return (
    <main className="matches-page">
      <section className="matches-header">
        <div>
          <h1>Palpites</h1>
          <p>
            Veja todos os jogadores do bolão. Rascunhos não aparecem aqui, e
            placares em branco indicam palpites ainda não confirmados.
          </p>
        </div>
        <div className="match-count">
          <strong>{activeTab === "jogos" ? matches.length : users.length}</strong>
          <span>{activeTab === "jogos" ? "jogos" : "jogadores"}</span>
        </div>
      </section>

      <nav className="prediction-tabs" aria-label="Tipo de visualização dos palpites">
        <Link
          aria-current={activeTab === "jogos" ? "page" : undefined}
          href={
            selectedMatch
              ? `/predictions?aba=jogos&jogo=${selectedMatch.id}`
              : "/predictions?aba=jogos"
          }
        >
          Jogos
        </Link>
        <Link
          aria-current={activeTab === "jogadores" ? "page" : undefined}
          href={
            selectedUser
              ? `/predictions?aba=jogadores&usuario=${selectedUser.id}`
              : "/predictions?aba=jogadores"
          }
        >
          Jogadores
        </Link>
      </nav>

      <section
        className="public-predictions-layout"
        aria-label={activeTab === "jogos" ? "Palpites por jogo" : "Palpites por jogador"}
      >
        <div className="prediction-sidebar-stack">
          <aside className="card prediction-user-list">
            <div className="card-head">
              <h2>{activeTab === "jogos" ? "Jogos" : "Jogadores"}</h2>
              <span className="meta">
                {activeTab === "jogos" ? matches.length : users.length} ativos
              </span>
            </div>
            {activeTab === "jogos" ? (
              matches.length === 0 ? (
                <div className="empty-state">
                  <strong>Nenhum jogo publicado</strong>
                  <span>Quando houver jogos publicados, eles aparecem aqui.</span>
                </div>
              ) : (
                <nav aria-label="Jogos publicados">
                  {matches.map((match) => (
                    <Link
                      aria-current={selectedMatch?.id === match.id ? "page" : undefined}
                      href={`/predictions?aba=jogos&jogo=${match.id}`}
                      key={match.id}
                    >
                      <span className="prediction-game-link">{matchupLabel(match)}</span>
                    </Link>
                  ))}
                </nav>
              )
            ) : users.length === 0 ? (
              <div className="empty-state">
                <strong>Nenhum jogador ativo</strong>
                <span>Quando houver jogadores ativos, os nomes aparecem aqui.</span>
              </div>
            ) : (
              <nav aria-label="Jogadores do bolão">
                {users.map((user) => (
                  <Link
                    aria-current={selectedUser?.id === user.id ? "page" : undefined}
                    href={`/predictions?aba=jogadores&usuario=${user.id}`}
                    key={user.id}
                  >
                    <UserIdentity
                      linkToPredictions={false}
                      suffix={signedInPlayer?.id === user.id ? " (você)" : ""}
                      user={user}
                    />
                  </Link>
                ))}
              </nav>
            )}
          </aside>
          {signedInPlayer ? (
            <PlayerSidebar className="prediction-player-sidebar" user={signedInPlayer} />
          ) : null}
        </div>

        <div className="prediction-detail-list">
          {activeTab === "jogos" ? (
            <GamePredictionComparison
              match={selectedMatch}
              predictions={selectedMatchPredictions}
              signedInPlayer={signedInPlayer}
              users={users}
            />
          ) : selectedUser ? (
            signedInPredictionData ? (
              <SignedInComparison
                currentData={signedInPredictionData}
                matches={matches}
                nextResultMatchId={nextResultMatchId}
                selectedData={predictionData}
                selectedUserPoints={selectedUserPoints}
                selectedUser={selectedUser}
              />
            ) : (
              <PredictionDetailCard
                data={predictionData}
                matches={matches}
                nextResultMatchId={nextResultMatchId}
                totalPoints={selectedUserPoints}
                user={selectedUser}
              />
            )
          ) : (
            <article className="card empty-state">
              <strong>Nenhum jogador ativo</strong>
              <span>Esta área fica em branco até alguém entrar no bolão.</span>
            </article>
          )}
        </div>
      </section>
    </main>
  );
}
