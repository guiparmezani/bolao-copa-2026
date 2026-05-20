import type { PlacementPredictionKind } from "@prisma/client";
import Link from "next/link";

import { PlayerSidebar } from "@/components/app-frame";
import { getCurrentUser } from "@/lib/auth/session";
import { placementLabels } from "@/lib/predictions/placement";
import { prisma } from "@/lib/prisma";
import {
  formatBrazilDate,
  formatBrazilTime,
  phaseLabels,
  statusLabels,
} from "@/lib/tournament";

export const dynamic = "force-dynamic";

type PredictionsPageProps = {
  searchParams?: Promise<{ usuario?: string }>;
};

async function getSubmittedUsers() {
  return prisma.user.findMany({
    where: {
      role: "player",
      status: "active",
      predictionSubmissions: {
        some: {
          status: "confirmed",
        },
      },
    },
    select: {
      displayName: true,
      id: true,
    },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
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
type SubmittedUser = Awaited<ReturnType<typeof getSubmittedUsers>>[number];
type PredictionData = Awaited<ReturnType<typeof getUserPredictionData>>;

const placementKinds: PlacementPredictionKind[] = ["champion", "runner_up", "third_place"];

function teamName(
  team: SubmittedMatchPrediction["match"]["homeTeam"],
  placeholder: string | null,
  flagPosition: "before" | "after",
) {
  if (!team) {
    return placeholder ?? "A definir";
  }

  return flagPosition === "after"
    ? `${team.namePt} ${team.flagEmoji}`
    : `${team.flagEmoji} ${team.namePt}`;
}

function officialScoreForMatch(match: SubmittedMatchPrediction["match"]) {
  if (match.homeGoals === null || match.awayGoals === null) {
    return "x";
  }

  return `${match.homeGoals} x ${match.awayGoals}`;
}

function groupByPhase(predictions: SubmittedMatchPrediction[]) {
  return predictions.reduce<Map<string, SubmittedMatchPrediction[]>>(
    (groups, prediction) => {
      const current = groups.get(prediction.match.phase) ?? [];
      current.push(prediction);
      groups.set(prediction.match.phase, current);
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

  return `${prediction.team.namePt} ${prediction.team.flagEmoji}`;
}

function predictionByMatchId(predictions: SubmittedMatchPrediction[]) {
  return new Map(predictions.map((prediction) => [prediction.matchId, prediction]));
}

function placementByKind(predictions: SubmittedPlacementPrediction[]) {
  return new Map(predictions.map((prediction) => [prediction.placement, prediction]));
}

function comparisonMatches(
  primary: SubmittedMatchPrediction[],
  secondary: SubmittedMatchPrediction[],
) {
  const matchById = new Map<string, SubmittedMatchPrediction["match"]>();

  for (const prediction of [...primary, ...secondary]) {
    matchById.set(prediction.matchId, prediction.match);
  }

  return Array.from(matchById.values()).sort((a, b) => {
    const kickoffDiff = a.kickoffAt.getTime() - b.kickoffAt.getTime();
    return kickoffDiff === 0 ? a.matchNumber - b.matchNumber : kickoffDiff;
  });
}

function PredictionDetailCard({
  data,
  user,
}: {
  data: PredictionData;
  user: SubmittedUser;
}) {
  const groupedPredictions = groupByPhase(data.matchPredictions);

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>{user.displayName}</h2>
        </div>
        <span className="meta">
          {data.matchPredictions.length} jogos / {data.placementPredictions.length} finais
        </span>
      </div>

      {data.placementPredictions.length > 0 ? (
        <div className="rules-list">
          {data.placementPredictions.map((prediction) => (
            <div className="rules-row compact" key={prediction.id}>
              <strong>{placementLabels[prediction.placement]}</strong>
              <span>
                {prediction.team.flagEmoji} {prediction.team.namePt}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {data.matchPredictions.length === 0 ? (
        <div className="empty-state">
          <strong>Nenhum palpite de jogo confirmado</strong>
          <span>Este jogador ainda não confirmou placares.</span>
        </div>
      ) : (
        Array.from(groupedPredictions.entries()).map(([phase, predictions]) => (
          <div className="public-prediction-section" key={phase}>
            <div className="schedule-day-head">
              <h3>{phaseLabels[phase as keyof typeof phaseLabels]}</h3>
              <span className="meta">{predictions.length} jogos</span>
            </div>
            <div className="schedule-day-matches">
              {predictions.map((prediction) => (
                <div className="comparison-row public-prediction-row" key={prediction.id}>
                  <span className="name">
                    <strong>
                      Jogo {prediction.match.matchNumber} •{" "}
                      {formatBrazilDate(prediction.match.kickoffAt)}
                    </strong>
                    <span>
                      {formatBrazilTime(prediction.match.kickoffAt)} •{" "}
                      {statusLabels[prediction.match.status]}
                    </span>
                  </span>
                  <span className="name">
                    <strong>
                      {teamName(
                        prediction.match.homeTeam,
                        prediction.match.homePlaceholder,
                        "after",
                      )}{" "}
                      x{" "}
                      {teamName(
                        prediction.match.awayTeam,
                        prediction.match.awayPlaceholder,
                        "before",
                      )}
                    </strong>
                    <span>Oficial: {officialScoreForMatch(prediction.match)}</span>
                  </span>
                  <span className="schedule-score">
                    {prediction.homeGoals} x {prediction.awayGoals}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

function SignedInComparison({
  currentData,
  selectedData,
  selectedUser,
}: {
  currentData: PredictionData;
  selectedData: PredictionData;
  selectedUser: SubmittedUser;
}) {
  const currentByMatch = predictionByMatchId(currentData.matchPredictions);
  const selectedByMatch = predictionByMatchId(selectedData.matchPredictions);
  const currentPlacements = placementByKind(currentData.placementPredictions);
  const selectedPlacements = placementByKind(selectedData.placementPredictions);
  const matches = comparisonMatches(currentData.matchPredictions, selectedData.matchPredictions);
  const hasPredictions =
    matches.length > 0 ||
    placementKinds.some(
      (placement) => currentPlacements.has(placement) || selectedPlacements.has(placement),
    );

  return (
    <section className="card prediction-comparison-card">
      <div className="card-head">
        <div>
          <h2>Você x {selectedUser.displayName}</h2>
          <span className="meta">Comparativo lado a lado</span>
        </div>
        <span className="meta">{matches.length} jogos</span>
      </div>

      {!hasPredictions ? (
        <div className="empty-state">
          <strong>Nenhum palpite confirmado para comparar</strong>
          <span>Quando houver envios confirmados, o comparativo aparece aqui.</span>
        </div>
      ) : (
        <>
          <div className="dual-placement-grid" aria-label="Comparativo de campeões">
            {placementKinds.map((placement) => (
              <div className="dual-placement-row" key={placement}>
                <strong>{placementLabels[placement]}</strong>
                <span>{placementText(currentPlacements.get(placement))}</span>
                <span>{placementText(selectedPlacements.get(placement))}</span>
              </div>
            ))}
          </div>

          <div className="dual-prediction-table" aria-label="Comparativo de placares">
            <div className="dual-prediction-row dual-prediction-heading">
              <span>Jogo</span>
              <span>Você</span>
              <span>{selectedUser.displayName}</span>
            </div>
            {matches.map((match) => (
              <div className="dual-prediction-row" key={match.id}>
                <span className="name">
                  <strong>
                    Jogo {match.matchNumber} • {formatBrazilDate(match.kickoffAt)}
                  </strong>
                  <span>
                    {formatBrazilTime(match.kickoffAt)} • {statusLabels[match.status]}
                  </span>
                  <span>
                    {teamName(match.homeTeam, match.homePlaceholder, "after")} x{" "}
                    {teamName(match.awayTeam, match.awayPlaceholder, "before")}
                  </span>
                  <span>Oficial: {officialScoreForMatch(match)}</span>
                </span>
                <span className="schedule-score">{scoreLabel(currentByMatch.get(match.id))}</span>
                <span className="schedule-score">{scoreLabel(selectedByMatch.get(match.id))}</span>
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
  const users = await getSubmittedUsers();
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
          <h1>Comparar</h1>
          <p>
            Veja os palpites de quem já confirmou o envio. Rascunhos não
            aparecem aqui.
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
              <span className="meta">{users.length} com envio</span>
            </div>
            {users.length === 0 ? (
              <div className="empty-state">
                <strong>Ninguém confirmou ainda</strong>
                <span>Quando os jogadores confirmarem, os nomes aparecem aqui.</span>
              </div>
            ) : (
              <nav aria-label="Jogadores com palpites confirmados">
                {users.map((user) => (
                  <Link
                    aria-current={selectedUser?.id === user.id ? "page" : undefined}
                    href={`/predictions?usuario=${user.id}`}
                    key={user.id}
                  >
                    <strong>
                      {user.displayName}
                      {signedInPlayer?.id === user.id ? " (você)" : ""}
                    </strong>
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
                selectedData={predictionData}
                selectedUser={selectedUser}
              />
            ) : (
              <PredictionDetailCard data={predictionData} user={selectedUser} />
            )
          ) : (
            <article className="card empty-state">
              <strong>Nenhum palpite enviado</strong>
              <span>Esta área fica em branco até alguém confirmar palpites.</span>
            </article>
          )}
        </div>
      </section>
    </main>
  );
}
