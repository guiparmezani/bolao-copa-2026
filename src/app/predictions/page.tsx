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
  searchParams?: Promise<{ usuario?: string }>;
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
        submission: {
          status: "confirmed",
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

type SubmittedMatchPrediction = Awaited<
  ReturnType<typeof getUserPredictionData>
>["matchPredictions"][number];
type SubmittedPlacementPrediction = Awaited<
  ReturnType<typeof getUserPredictionData>
>["placementPredictions"][number];
type PredictionMatch = Awaited<ReturnType<typeof getPublishedPredictionMatches>>[number];
type PredictionUser = Awaited<ReturnType<typeof getPredictionUsers>>[number];
type PredictionData = Awaited<ReturnType<typeof getUserPredictionData>>;

const placementKinds: PlacementPredictionKind[] = ["champion", "runner_up", "third_place"];

function formatCompactBrazilDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: brazilTimeZone,
    year: "numeric",
  }).format(value);
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

function predictionByMatchId(predictions: SubmittedMatchPrediction[]) {
  return new Map(predictions.map((prediction) => [prediction.matchId, prediction]));
}

function placementByKind(predictions: SubmittedPlacementPrediction[]) {
  return new Map(predictions.map((prediction) => [prediction.placement, prediction]));
}

function PredictionMatchSummary({ match }: { match: PredictionMatch }) {
  return (
    <div className="public-match-summary">
      <span className="public-match-line">
        <strong className="public-match-title">Jogo {match.matchNumber}</strong>
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
  user,
}: {
  data: PredictionData;
  matches: PredictionMatch[];
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
        <span className="meta">
          {data.matchPredictions.length} de {matches.length} jogos /{" "}
          {data.placementPredictions.length} finais
        </span>
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

                return (
                  <div className="comparison-row public-prediction-row" key={match.id}>
                    <PredictionMatchSummary match={match} />
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
  selectedData,
  selectedUser,
}: {
  currentData: PredictionData;
  matches: PredictionMatch[];
  selectedData: PredictionData;
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
        <span className="meta">{matches.length} jogos</span>
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
            {matches.map((match) => (
              <div className="dual-prediction-row" key={match.id}>
                <PredictionMatchSummary match={match} />
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
            ))}
          </div>
        </>
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
  const [users, matches] = await Promise.all([
    getPredictionUsers(),
    getPublishedPredictionMatches(),
  ]);
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
  const predictionEntries = await Promise.all(
    dataUserIds.map(async (userId) => [userId, await getUserPredictionData(userId)] as const),
  );
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

  return (
    <main className="matches-page">
      <section className="matches-header">
        <div>
          <span className="chip">Palpites públicos</span>
          <h1>Palpites</h1>
          <p>
            Veja todos os jogadores do bolão. Rascunhos não aparecem aqui, e
            placares em branco indicam palpites ainda não confirmados.
          </p>
        </div>
        <div className="match-count">
          <strong>{users.length}</strong>
          <span>jogadores</span>
        </div>
      </section>

      <section className="public-predictions-layout" aria-label="Palpites por jogador">
        <div className="prediction-sidebar-stack">
          <aside className="card prediction-user-list">
            <div className="card-head">
              <h2>Jogadores</h2>
              <span className="meta">{users.length} ativos</span>
            </div>
            {users.length === 0 ? (
              <div className="empty-state">
                <strong>Nenhum jogador ativo</strong>
                <span>Quando houver jogadores ativos, os nomes aparecem aqui.</span>
              </div>
            ) : (
              <nav aria-label="Jogadores do bolão">
                {users.map((user) => (
                  <Link
                    aria-current={selectedUser?.id === user.id ? "page" : undefined}
                    href={`/predictions?usuario=${user.id}`}
                    key={user.id}
                  >
                    <UserIdentity
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
          {selectedUser ? (
            signedInPredictionData ? (
              <SignedInComparison
                currentData={signedInPredictionData}
                matches={matches}
                selectedData={predictionData}
                selectedUser={selectedUser}
              />
            ) : (
              <PredictionDetailCard data={predictionData} matches={matches} user={selectedUser} />
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
