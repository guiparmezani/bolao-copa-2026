import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  formatBrazilDate,
  formatBrazilTime,
  getBrazilDateKey,
  phaseLabels,
  statusLabels,
} from "@/lib/tournament";

export const dynamic = "force-dynamic";

type MatchesPageProps = {
  searchParams?: Promise<{
    filtro?: string;
    time?: string;
  }>;
};

type PublishedMatch = Awaited<ReturnType<typeof getPublishedMatches>>[number];

const filters = [
  { label: "Todos", href: "/matches" },
  { label: "Hoje", href: "/matches?filtro=today" },
  { label: "Ao vivo", href: "/matches?filtro=live" },
  { label: "Grupos", href: "/matches?filtro=group" },
  { label: "Mata-mata", href: "/matches?filtro=knockout" },
];

async function getPublishedMatches() {
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

function getTeamLabel(
  team: PublishedMatch["homeTeam"],
  placeholder: string | null,
) {
  if (team) {
    return {
      flag: team.flagEmoji,
      name: team.namePt,
      placeholder: false,
    };
  }

  return {
    flag: "□",
    name: placeholder ?? "A definir",
    placeholder: true,
  };
}

function matchSearchText(match: PublishedMatch) {
  return [
    match.homeTeam?.namePt,
    match.homeTeam?.nameEn,
    match.awayTeam?.namePt,
    match.awayTeam?.nameEn,
    match.homePlaceholder,
    match.awayPlaceholder,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function applyFilters(
  matches: PublishedMatch[],
  filtro: string | undefined,
  teamQuery: string | undefined,
) {
  const todayKey = getBrazilDateKey(new Date());
  const normalizedTeamQuery = teamQuery?.trim().toLowerCase();

  return matches.filter((match) => {
    if (filtro === "today" && getBrazilDateKey(match.kickoffAt) !== todayKey) {
      return false;
    }

    if (filtro === "live" && match.status !== "live" && match.status !== "paused") {
      return false;
    }

    if (filtro === "group" && match.phase !== "group") {
      return false;
    }

    if (filtro === "knockout" && match.phase === "group") {
      return false;
    }

    if (normalizedTeamQuery && !matchSearchText(match).includes(normalizedTeamQuery)) {
      return false;
    }

    return true;
  });
}

function groupMatchesByDate(matches: PublishedMatch[]) {
  return matches.reduce<Map<string, PublishedMatch[]>>((groups, match) => {
    const key = getBrazilDateKey(match.kickoffAt);
    const current = groups.get(key) ?? [];
    current.push(match);
    groups.set(key, current);
    return groups;
  }, new Map());
}

function getScore(match: PublishedMatch) {
  if (match.homeGoals === null || match.awayGoals === null) {
    return "x";
  }

  return `${match.homeGoals} x ${match.awayGoals}`;
}

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const params = (await searchParams) ?? {};
  const matches = await getPublishedMatches();
  const filteredMatches = applyFilters(matches, params.filtro, params.time);
  const groupedMatches = groupMatchesByDate(filteredMatches);
  const activeFilter = params.filtro ?? "all";

  return (
    <main className="matches-page">
      <section className="matches-header">
        <div>
          <span className="chip">Tabela publicada</span>
          <h1>Jogos da Copa 2026</h1>
          <p>
            Horários em Brasília, confrontos oficiais publicados e placeholders
            do mata-mata enquanto as vagas não forem definidas.
          </p>
        </div>
        <div className="match-count">
          <strong>{filteredMatches.length}</strong>
          <span>jogos</span>
        </div>
      </section>

      <section className="match-tools" aria-label="Filtros de jogos">
        <nav className="filter-list" aria-label="Filtro rápido">
          {filters.map((filter) => {
            const isActive =
              (activeFilter === "all" && filter.href === "/matches") ||
              filter.href.endsWith(`=${activeFilter}`);

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className="filter-chip"
                href={filter.href}
                key={filter.label}
              >
                {filter.label}
              </Link>
            );
          })}
        </nav>
        <form className="team-filter" action="/matches">
          {params.filtro ? (
            <input name="filtro" type="hidden" value={params.filtro} />
          ) : null}
          <label>
            <span>Buscar seleção</span>
            <input
              defaultValue={params.time}
              name="time"
              placeholder="Brasil, Portugal, W101..."
              type="search"
            />
          </label>
          <button className="button primary" type="submit">
            Filtrar
          </button>
        </form>
      </section>

      <section className="schedule-list" aria-label="Calendário de jogos">
        {groupedMatches.size === 0 ? (
          <article className="card empty-state">
            <strong>Nenhum jogo encontrado</strong>
            <span>Ajuste os filtros para ver a tabela publicada.</span>
          </article>
        ) : (
          Array.from(groupedMatches.entries()).map(([dateKey, dayMatches]) => (
            <article className="schedule-day" key={dateKey}>
              <div className="schedule-day-head">
                <h2>{formatBrazilDate(dayMatches[0].kickoffAt)}</h2>
                <span className="meta">{dayMatches.length} jogos</span>
              </div>
              <div className="schedule-day-matches">
                {dayMatches.map((match) => {
                  const home = getTeamLabel(match.homeTeam, match.homePlaceholder);
                  const away = getTeamLabel(match.awayTeam, match.awayPlaceholder);
                  const phaseLabel = phaseLabels[match.phase];

                  return (
                    <div className="schedule-match" key={match.id}>
                      <div className="match-meta-line">
                        <span>Jogo {match.matchNumber}</span>
                        <span>{formatBrazilTime(match.kickoffAt)}</span>
                        <span>{phaseLabel}</span>
                        {match.groupName ? <span>{match.groupName}</span> : null}
                      </div>
                      <div className="match-main-line">
                        <span
                          className={
                            home.placeholder ? "schedule-team placeholder" : "schedule-team"
                          }
                        >
                          <span aria-hidden="true">{home.flag}</span>
                          <strong>{home.name}</strong>
                        </span>
                        <span className="schedule-score">{getScore(match)}</span>
                        <span
                          className={
                            away.placeholder
                              ? "schedule-team away placeholder"
                              : "schedule-team away"
                          }
                        >
                          <span aria-hidden="true">{away.flag}</span>
                          <strong>{away.name}</strong>
                        </span>
                      </div>
                      <div className="match-meta-line lower">
                        <span>{match.venueName}</span>
                        <span>{match.venueCity}</span>
                        <span>{statusLabels[match.status]}</span>
                        <span>Publicado</span>
                      </div>
                      {match.homePenalties !== null || match.awayPenalties !== null ? (
                        <div className="penalty-line">
                          Pênaltis: {match.homePenalties ?? 0} x{" "}
                          {match.awayPenalties ?? 0}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
