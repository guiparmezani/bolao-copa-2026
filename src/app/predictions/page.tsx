import Link from "next/link";

import { canRevealMatchPredictions } from "@/lib/predictions/reveal";
import { prisma } from "@/lib/prisma";
import {
  formatBrazilDate,
  formatBrazilTime,
  phaseLabels,
  statusLabels,
} from "@/lib/tournament";

export const dynamic = "force-dynamic";

type ComparisonMatch = Awaited<ReturnType<typeof getComparisonMatches>>[number];

async function getComparisonMatches() {
  return prisma.match.findMany({
    where: {
      publicationStatus: "published",
    },
    include: {
      awayTeam: true,
      homeTeam: true,
      matchPredictions: {
        where: {
          confirmedAt: {
            not: null,
          },
          submission: {
            status: "confirmed",
          },
          user: {
            status: "active",
          },
        },
        include: {
          score: true,
          user: true,
        },
        orderBy: {
          user: {
            displayName: "asc",
          },
        },
      },
    },
    orderBy: [{ kickoffAt: "asc" }, { matchNumber: "asc" }],
  });
}

function getTeamName(
  team: ComparisonMatch["homeTeam"],
  placeholder: string | null,
) {
  return team ? `${team.flagEmoji} ${team.namePt}` : placeholder ?? "A definir";
}

function getOfficialScore(match: ComparisonMatch) {
  if (match.homeGoals === null || match.awayGoals === null) {
    return "x";
  }

  return `${match.homeGoals} x ${match.awayGoals}`;
}

function formatPredictionScore(match: ComparisonMatch, prediction: ComparisonMatch["matchPredictions"][number]) {
  if (!canRevealMatchPredictions(match)) {
    return "Oculto";
  }

  return `${prediction.homeGoals} x ${prediction.awayGoals}`;
}

function formatPoints(value: unknown) {
  if (!value || typeof value !== "object" || !("toNumber" in value)) {
    return "0";
  }

  const points = (value as { toNumber: () => number }).toNumber();
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: points % 1 === 0 ? 0 : 1,
  }).format(points);
}

export default async function PredictionsComparisonPage() {
  const matches = await getComparisonMatches();
  const revealedCount = matches.filter(canRevealMatchPredictions).length;
  const confirmedPredictionCount = matches.reduce(
    (total, match) => total + match.matchPredictions.length,
    0,
  );

  return (
    <main className="matches-page">
      <section className="matches-header">
        <div>
          <span className="chip">Comparação pública</span>
          <h1>Palpites da galera</h1>
          <p>
            Todo palpite confirmado aparece aqui, mas o placar de cada jogador
            só é revelado depois que o jogo termina oficialmente.
          </p>
        </div>
        <div className="match-count">
          <strong>{revealedCount}</strong>
          <span>jogos revelados</span>
        </div>
      </section>

      <section className="match-tools" aria-label="Resumo da comparação">
        <div className="filter-list">
          <span className="filter-chip" aria-current="page">
            {confirmedPredictionCount} palpites confirmados
          </span>
          <span className="filter-chip">{matches.length} jogos publicados</span>
        </div>
        <Link className="button" href="/rules">
          Ver regras de pontuação
        </Link>
      </section>

      <section className="schedule-list" aria-label="Comparação de palpites">
        {matches.map((match) => {
          const isRevealed = canRevealMatchPredictions(match);

          return (
            <article className="schedule-day comparison-card" key={match.id}>
              <div className="schedule-day-head">
                <div>
                  <h2>
                    Jogo {match.matchNumber} • {phaseLabels[match.phase]}
                  </h2>
                  <span className="meta">
                    {formatBrazilDate(match.kickoffAt)} •{" "}
                    {formatBrazilTime(match.kickoffAt)} •{" "}
                    {statusLabels[match.status]}
                  </span>
                </div>
                <span className={isRevealed ? "chip" : "chip muted-chip"}>
                  {isRevealed ? "Revelado" : "Oculto"}
                </span>
              </div>
              <div className="comparison-scoreboard">
                <span>{getTeamName(match.homeTeam, match.homePlaceholder)}</span>
                <strong>{isRevealed ? getOfficialScore(match) : "x"}</strong>
                <span>{getTeamName(match.awayTeam, match.awayPlaceholder)}</span>
              </div>
              {match.matchPredictions.length === 0 ? (
                <div className="empty-state">
                  <strong>Nenhum palpite confirmado para este jogo</strong>
                  <span>Assim que alguém confirmar, o envio aparece aqui.</span>
                </div>
              ) : (
                <div className="comparison-grid">
                  {match.matchPredictions.map((prediction) => (
                    <div className="comparison-row" key={prediction.id}>
                      <span className="name">
                        <strong>{prediction.user.displayName}</strong>
                        <span>{prediction.user.username}</span>
                      </span>
                      <span className={isRevealed ? "schedule-score" : "hidden-score"}>
                        {formatPredictionScore(match, prediction)}
                      </span>
                      <span className="pts">
                        {isRevealed && prediction.score
                          ? `${formatPoints(prediction.score.totalPoints)} pts`
                          : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
