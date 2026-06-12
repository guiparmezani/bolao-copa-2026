import Link from "next/link";
import { TeamFlag } from "@/components/team-flag";
import { UserAvatar } from "@/components/user-avatar";
import {
  formatBrazilDate,
  formatBrazilTime,
  phaseLabels,
} from "@/lib/tournament";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getLatestFinishedMatches() {
  return prisma.match.findMany({
    where: {
      awayGoals: {
        not: null,
      },
      homeGoals: {
        not: null,
      },
      publicationStatus: "published",
      status: "finished",
    },
    include: {
      awayTeam: true,
      homeTeam: true,
    },
    orderBy: [{ kickoffAt: "desc" }, { matchNumber: "desc" }],
    take: 2,
  });
}

type HomeMatch = Awaited<ReturnType<typeof getLatestFinishedMatches>>[number];

async function getSpotlightNextMatch(latestFinishedMatch: HomeMatch | null, now: Date) {
  if (!latestFinishedMatch) {
    const nextScheduledMatch = await prisma.match.findFirst({
      where: {
        OR: [{ homeGoals: null }, { awayGoals: null }],
        kickoffAt: {
          gte: now,
        },
        publicationStatus: "published",
      },
      include: {
        awayTeam: true,
        homeTeam: true,
      },
      orderBy: [{ kickoffAt: "asc" }, { matchNumber: "asc" }],
    });

    if (nextScheduledMatch) {
      return nextScheduledMatch;
    }

    return prisma.match.findFirst({
      where: {
        OR: [{ homeGoals: null }, { awayGoals: null }],
        publicationStatus: "published",
      },
      include: {
        awayTeam: true,
        homeTeam: true,
      },
      orderBy: [{ kickoffAt: "asc" }, { matchNumber: "asc" }],
    });
  }

  return prisma.match.findFirst({
    where: {
      OR: [
        {
          kickoffAt: {
            gt: latestFinishedMatch.kickoffAt,
          },
        },
        {
          kickoffAt: latestFinishedMatch.kickoffAt,
          matchNumber: {
            gt: latestFinishedMatch.matchNumber,
          },
        },
      ],
      AND: [
        {
          OR: [{ homeGoals: null }, { awayGoals: null }],
        },
      ],
      publicationStatus: "published",
    },
    include: {
      awayTeam: true,
      homeTeam: true,
    },
    orderBy: [{ kickoffAt: "asc" }, { matchNumber: "asc" }],
  });
}

function getTeamLabel(team: HomeMatch["homeTeam"], placeholder: string | null) {
  return team
    ? { name: team.namePt, team }
    : { name: placeholder ?? "A definir", team: null };
}

function getScore(match: Pick<HomeMatch, "homeGoals" | "awayGoals">) {
  if (match.homeGoals === null || match.awayGoals === null) {
    return "x";
  }

  return `${match.homeGoals} x ${match.awayGoals}`;
}

function formatPoints(value: { toNumber: () => number }) {
  const points = value.toNumber();

  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: points % 1 === 0 ? 0 : 1,
  }).format(points);
}

function formatUpdatedAt(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(value);
}

function MatchSpotlight({
  label,
  match,
  scoreContext,
}: {
  label: string;
  match: HomeMatch | null;
  scoreContext: string;
}) {
  return (
    <div className="feature-match">
      <span className="feature-match-label">{label}</span>
      {match ? (
        <>
          <div className="teams">
            {(() => {
              const home = getTeamLabel(match.homeTeam, match.homePlaceholder);
              const away = getTeamLabel(match.awayTeam, match.awayPlaceholder);

              return (
                <>
                  <span className="team">
                    <strong>{home.name}</strong>
                    <TeamFlag team={home.team} />
                  </span>
                  <span className="score">{getScore(match)}</span>
                  <span className="team">
                    <TeamFlag team={away.team} />
                    <strong>{away.name}</strong>
                  </span>
                </>
              );
            })()}
          </div>
          <span className="meta">
            {phaseLabels[match.phase]} • {formatBrazilDate(match.kickoffAt)} •{" "}
            {formatBrazilTime(match.kickoffAt)} • {scoreContext}
          </span>
        </>
      ) : (
        <div className="empty-state compact-feature-empty">
          <strong>Nenhum jogo disponível</strong>
          <span>Assim que houver dados publicados, esta área será atualizada.</span>
        </div>
      )}
    </div>
  );
}

export default async function Home() {
  const now = new Date();
  const [latestFinishedMatches, leaderboard] = await Promise.all([
    getLatestFinishedMatches(),
    prisma.leaderboardSnapshot.findMany({
      include: {
        user: true,
      },
      orderBy: [{ rank: "asc" }, { totalPoints: "desc" }],
      take: 5,
      where: {
        user: {
          status: "active",
        },
      },
    }),
  ]);
  const latestFinishedMatch = latestFinishedMatches[0] ?? null;
  const spotlightNextMatch = await getSpotlightNextMatch(latestFinishedMatch, now);
  const latestLeaderboardUpdate = leaderboard[0]?.computedAt;

  return (
    <main>
      <section className="hero" id="inicio">
        <div className="hero-grid">
          <div className="hero-copy" id="entrar">
            <h1>Bolão dos Facabundos Copa 2026</h1>
            <p>
              Ranking, calendário e regras em uma experiência direta para
              acompanhar o bolão e tirar uma grana.
            </p>
            <div className="chips">
              <Link className="button primary" href="/signup">
                Criar conta
              </Link>
              <Link className="button" href="/matches">
                Ver jogos
              </Link>
            </div>
          </div>

          <aside className="card" aria-label="Jogos em destaque">
            <div className="card-head">
              <h2>Jogos em destaque</h2>
              <span className="meta">Resultados e agenda</span>
            </div>
            <div className="feature-match-list">
              <MatchSpotlight
                label="Próximo jogo"
                match={spotlightNextMatch}
                scoreContext="agenda"
              />
              <MatchSpotlight
                label="Último resultado"
                match={latestFinishedMatches[0] ?? null}
                scoreContext="resultado oficial"
              />
              <MatchSpotlight
                label="Resultado anterior"
                match={latestFinishedMatches[1] ?? null}
                scoreContext="resultado oficial"
              />
            </div>
          </aside>
        </div>
      </section>

      <section className="band" aria-label="Prévia pública">
        <div className="home-panels-layout">
          <article className="card home-ranking-card" id="ranking">
            <div className="card-head">
              <h2>Ranking geral</h2>
              <span className="meta">
                {latestLeaderboardUpdate
                  ? `Atualizado em ${formatUpdatedAt(latestLeaderboardUpdate)}`
                  : "Aguardando pontuação"}
              </span>
            </div>
            <div>
              {leaderboard.length === 0 ? (
                <div className="empty-state">
                  <strong>Ranking ainda vazio</strong>
                  <span>
                    Assim que houver pontos calculados, a classificação aparece aqui.
                  </span>
                </div>
              ) : (
                leaderboard.map((entry) => (
                  <div className="row" key={entry.id}>
                    <span
                      aria-label={`${entry.rank}º lugar`}
                      className="rank rank-avatar"
                      title={`${entry.rank}º lugar`}
                    >
                      <UserAvatar user={entry.user} />
                    </span>
                    <span className="name">
                      <strong>{entry.user.displayName}</strong>
                      <span>
                        {entry.exactCount} exatos • {entry.outcomeCount} vencedores
                      </span>
                    </span>
                    <span className="pts">{formatPoints(entry.totalPoints)}</span>
                  </div>
                ))
              )}
            </div>
          </article>

          <aside className="home-panels-side">
            <article className="card" id="regras">
              <div className="card-head">
                <h2>Como funciona</h2>
                <span className="meta">Modelo 2022</span>
              </div>
              <div className="info">
                <span>
                  Primeiro entram os placares da fase de grupos. Depois que os
                  confrontos do mata-mata estiverem definidos, abre a segunda
                  rodada de palpites.
                </span>
                <Link className="button" href="/rules">
                  Ler regras completas
                </Link>
              </div>
            </article>

            <article className="card">
              <div className="card-head">
                <h2>Pronto para entrar?</h2>
                <span className="meta">Conta obrigatória</span>
              </div>
              <div className="info">
                <span>
                  Depois de entrar, você vê suas telas privadas de envio. A
                  página inicial continua pública e sem dados restritos.
                </span>
                <Link className="button primary" href="/signup">
                  Criar conta ou entrar
                </Link>
              </div>
            </article>
          </aside>
        </div>
      </section>
    </main>
  );
}
