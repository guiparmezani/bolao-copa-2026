import Link from "next/link";
import {
  formatBrazilDate,
  formatBrazilTime,
  phaseLabels,
  statusLabels,
} from "@/lib/tournament";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getNextMatches(now: Date) {
  return prisma.match.findMany({
    where: {
      publicationStatus: "published",
      kickoffAt: {
        gte: now,
      },
    },
    include: {
      awayTeam: true,
      homeTeam: true,
    },
    orderBy: [{ kickoffAt: "asc" }, { matchNumber: "asc" }],
    take: 3,
  });
}

async function getFeaturedLiveMatch() {
  return prisma.match.findFirst({
    where: {
      publicationStatus: "published",
      status: {
        in: ["live", "paused"],
      },
    },
    include: {
      awayTeam: true,
      homeTeam: true,
    },
    orderBy: [{ kickoffAt: "asc" }, { matchNumber: "asc" }],
  });
}

type HomeMatch = Awaited<ReturnType<typeof getNextMatches>>[number];

function getTeamLabel(team: HomeMatch["homeTeam"], placeholder: string | null) {
  return team
    ? { flag: team.flagEmoji, name: team.namePt }
    : { flag: "", name: placeholder ?? "A definir" };
}

function getTeamName(
  team: HomeMatch["homeTeam"],
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

export default async function Home() {
  const now = new Date();
  const [
    featuredMatch,
    leaderboard,
    nextMatches,
    publishedMatchCount,
    groupMatchCount,
    knockoutMatchCount,
    activePlayerCount,
  ] = await Promise.all([
    getFeaturedLiveMatch(),
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
    getNextMatches(now),
    prisma.match.count({ where: { publicationStatus: "published" } }),
    prisma.match.count({
      where: {
        phase: "group",
        publicationStatus: "published",
      },
    }),
    prisma.match.count({
      where: {
        phase: {
          not: "group",
        },
        publicationStatus: "published",
      },
    }),
    prisma.user.count({
      where: {
        role: "player",
        status: "active",
      },
    }),
  ]);
  const latestLeaderboardUpdate = leaderboard[0]?.computedAt;
  const stats = [
    { value: publishedMatchCount, label: "jogos publicados" },
    { value: groupMatchCount, label: "fase de grupos" },
    { value: knockoutMatchCount, label: "mata-mata" },
    { value: activePlayerCount, label: "jogadores ativos" },
  ];

  return (
    <main>
      <section className="hero" id="inicio">
        <div className="hero-grid">
          <div className="hero-copy" id="entrar">
            <h1>Bolão dos Facabundos Copa 2026</h1>
            <p>
              Ranking, calendário e regras em uma experiência direta para
              acompanhar o bolão e tirar uma grana. Lemos queima a rosca.
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

          <aside className="card" aria-label="Jogo em destaque">
            <div className="card-head">
              <h2>Jogo em destaque</h2>
              <span className={featuredMatch ? "meta live" : "meta"}>
                {featuredMatch ? statusLabels[featuredMatch.status] : "Sem jogo ao vivo"}
              </span>
            </div>
            {featuredMatch ? (
              <div className="feature-match">
                <div className="teams">
                  {(() => {
                    const home = getTeamLabel(
                      featuredMatch.homeTeam,
                      featuredMatch.homePlaceholder,
                    );
                    const away = getTeamLabel(
                      featuredMatch.awayTeam,
                      featuredMatch.awayPlaceholder,
                    );

                    return (
                      <>
                        <span className="team">
                          <strong>{home.name}</strong>
                          {home.flag ? <span aria-hidden="true">{home.flag}</span> : null}
                        </span>
                        <span className="score">{getScore(featuredMatch)}</span>
                        <span className="team">
                          {away.flag ? <span aria-hidden="true">{away.flag}</span> : null}
                          <strong>{away.name}</strong>
                        </span>
                      </>
                    );
                  })()}
                </div>
                <span className="meta">
                  {phaseLabels[featuredMatch.phase]} •{" "}
                  {formatBrazilTime(featuredMatch.kickoffAt)} • placar oficial
                </span>
              </div>
            ) : (
              <div className="empty-state">
                <strong>Nenhum jogo ao vivo agora</strong>
                <span>Quando houver placar oficial, ele aparece aqui.</span>
              </div>
            )}
            <div className="metrics">
              {stats.map((stat) => (
                <div className="metric" key={stat.label}>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className="band" aria-label="Prévia pública">
        <div className="layout">
          <article className="card" id="ranking">
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
                  <span>Assim que houver pontos calculados, a classificação aparece aqui.</span>
                </div>
              ) : (
                leaderboard.map((entry) => (
                  <div className="row" key={entry.id}>
                    <span className="rank">{entry.rank}</span>
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

          <article className="card" id="jogos">
            <div className="card-head">
              <h2>Próximos jogos</h2>
              <span className="meta">Horário de Brasília</span>
            </div>
            <div className="matches">
              {nextMatches.length === 0 ? (
                <div className="empty-state">
                  <strong>Nenhum jogo publicado</strong>
                  <span>Quando a tabela estiver disponível, os próximos jogos aparecem aqui.</span>
                </div>
              ) : (
                nextMatches.map((match) => (
                  <div className="match-mini" key={match.id}>
                    <div className="line">
                      <span>
                        {formatBrazilDate(match.kickoffAt)} •{" "}
                        {formatBrazilTime(match.kickoffAt)}
                      </span>
                      <span>{phaseLabels[match.phase]}</span>
                    </div>
                    <strong>
                      {getTeamName(match.homeTeam, match.homePlaceholder, "after")} x{" "}
                      {getTeamName(match.awayTeam, match.awayPlaceholder, "before")}
                    </strong>
                  </div>
                ))
              )}
            </div>
            <div className="info compact-info">
              <Link className="button" href="/matches">
                Ver tabela completa
              </Link>
            </div>
          </article>
        </div>

        <div className="layout">
          <article className="card" id="regras">
            <div className="card-head">
              <h2>Como funciona</h2>
              <span className="meta">Modelo 2022</span>
            </div>
            <div className="info">
              <strong>Dois momentos para palpitar</strong>
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
              <strong>Seus palpites ficam protegidos</strong>
              <span>
                Depois de entrar, você vê suas telas privadas de envio. A
                página inicial continua pública e sem dados restritos.
              </span>
              <Link className="button primary" href="/signup">
                Criar conta ou entrar
              </Link>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
