import Link from "next/link";

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
      username: true,
    },
    orderBy: [{ displayName: "asc" }, { username: "asc" }],
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

function teamName(
  team: SubmittedMatchPrediction["match"]["homeTeam"],
  placeholder: string | null,
) {
  return team ? `${team.flagEmoji} ${team.namePt}` : placeholder ?? "A definir";
}

function officialScore(prediction: SubmittedMatchPrediction) {
  const { match } = prediction;

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

export default async function PublicPredictionsPage({
  searchParams,
}: PredictionsPageProps) {
  const params = (await searchParams) ?? {};
  const users = await getSubmittedUsers();
  const selectedUser =
    users.find((user) => user.id === params.usuario) ?? users[0] ?? null;
  const predictionData = selectedUser
    ? await getUserPredictionData(selectedUser.id)
    : { matchPredictions: [], placementPredictions: [] };
  const groupedPredictions = groupByPhase(predictionData.matchPredictions);

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
                  <strong>{user.displayName}</strong>
                  <span>@{user.username}</span>
                </Link>
              ))}
            </nav>
          )}
        </aside>

        <div className="prediction-detail-list">
          {selectedUser ? (
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>{selectedUser.displayName}</h2>
                  <span className="meta">@{selectedUser.username}</span>
                </div>
                <span className="meta">
                  {predictionData.matchPredictions.length} jogos /{" "}
                  {predictionData.placementPredictions.length} finais
                </span>
              </div>

              {predictionData.placementPredictions.length > 0 ? (
                <div className="rules-list">
                  {predictionData.placementPredictions.map((prediction) => (
                    <div className="rules-row compact" key={prediction.id}>
                      <strong>{placementLabels[prediction.placement]}</strong>
                      <span>
                        {prediction.team.flagEmoji} {prediction.team.namePt}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}

              {predictionData.matchPredictions.length === 0 ? (
                <div className="empty-state">
                  <strong>Nenhum palpite de jogo confirmado</strong>
                  <span>Este jogador ainda não confirmou placares.</span>
                </div>
              ) : (
                Array.from(groupedPredictions.entries()).map(
                  ([phase, predictions]) => (
                    <div className="public-prediction-section" key={phase}>
                      <div className="schedule-day-head">
                        <h3>{phaseLabels[phase as keyof typeof phaseLabels]}</h3>
                        <span className="meta">{predictions.length} jogos</span>
                      </div>
                      <div className="schedule-day-matches">
                        {predictions.map((prediction) => (
                          <div
                            className="comparison-row public-prediction-row"
                            key={prediction.id}
                          >
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
                                )}{" "}
                                x{" "}
                                {teamName(
                                  prediction.match.awayTeam,
                                  prediction.match.awayPlaceholder,
                                )}
                              </strong>
                              <span>Oficial: {officialScore(prediction)}</span>
                            </span>
                            <span className="schedule-score">
                              {prediction.homeGoals} x {prediction.awayGoals}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                )
              )}
            </section>
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
