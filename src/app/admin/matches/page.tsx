import Link from "next/link";

import { AdminNotice } from "@/components/admin-notice";
import { TeamLabel } from "@/components/team-flag";
import { requireAdminPage } from "@/lib/admin/auth";
import { formatAdminDate } from "@/lib/admin/format";
import { prisma } from "@/lib/prisma";
import { phaseLabels, statusLabels } from "@/lib/tournament";

export const dynamic = "force-dynamic";

function scoreValue(value: number | null) {
  return value === null ? "" : String(value);
}

function teamName(team: { namePt: string } | null, placeholder: string | null) {
  return team?.namePt ?? placeholder ?? "A definir";
}

function hasFinalScore(match: { awayGoals: number | null; homeGoals: number | null }) {
  return match.awayGoals !== null && match.homeGoals !== null;
}

type AdminMatchesPageProps = {
  searchParams?: Promise<{ aviso?: string; erro?: string; mensagem?: string }>;
};

export default async function AdminMatchesPage({ searchParams }: AdminMatchesPageProps) {
  await requireAdminPage();
  const { aviso, erro, mensagem } = (await searchParams) ?? {};
  const matches = (await prisma.match.findMany({
    include: {
      awayTeam: true,
      homeTeam: true,
    },
    orderBy: [{ kickoffAt: "asc" }, { matchNumber: "asc" }],
  })).sort((a, b) => {
    const scoreOrder = Number(hasFinalScore(a)) - Number(hasFinalScore(b));

    return scoreOrder || a.kickoffAt.getTime() - b.kickoffAt.getTime() || a.matchNumber - b.matchNumber;
  });

  return (
    <main className="admin-page">
      <section className="matches-header">
        <div>
          <h1>Jogos</h1>
          <p>Publicação, metadados e resultados oficiais usados no bolão.</p>
        </div>
        <Link className="button" href="/admin">Voltar ao admin</Link>
      </section>
      <AdminNotice aviso={aviso} erro={erro} mensagem={mensagem} />

      <section className="schedule-list">
        {matches.map((match) => {
          const homeName = teamName(match.homeTeam, match.homePlaceholder);
          const awayName = teamName(match.awayTeam, match.awayPlaceholder);

          return (
          <article className="schedule-day" key={match.id}>
            <div className="schedule-day-head">
              <div>
                <h2>Jogo {match.matchNumber} • {phaseLabels[match.phase]}</h2>
                <span className="meta">
                  {formatAdminDate(match.kickoffAt)} • {statusLabels[match.status]} • {match.publicationStatus}
                </span>
              </div>
              {match.publicationStatus !== "published" ? (
                <form action={`/api/admin/matches/${match.id}/publish`} method="post">
                  <button className="button primary" type="submit">Publicar</button>
                </form>
              ) : null}
            </div>
            <form className="admin-match-form" action={`/api/admin/matches/${match.id}`} method="post">
              <div className="admin-score-editor">
                <div className="admin-score-context">
                  <span className="eyebrow">Resultado oficial</span>
                  <strong>
                    <TeamLabel flagPosition="after" placeholder={match.homePlaceholder} team={match.homeTeam} />
                    {" x "}
                    <TeamLabel flagPosition="after" placeholder={match.awayPlaceholder} team={match.awayTeam} />
                  </strong>
                  <span>Salvar um placar completo marca o jogo como Encerrado e recalcula o ranking.</span>
                </div>
                <div className="admin-score-board" aria-label={`Placar oficial: ${homeName} contra ${awayName}`}>
                  <label className="admin-score-side">
                    <span className="admin-score-team">{homeName}</span>
                    <input
                      aria-label={`Gols de ${homeName}`}
                      className="admin-score-input"
                      inputMode="numeric"
                      min="0"
                      name="homeGoals"
                      type="number"
                      defaultValue={scoreValue(match.homeGoals)}
                    />
                  </label>
                  <span className="admin-score-separator">x</span>
                  <label className="admin-score-side">
                    <span className="admin-score-team">{awayName}</span>
                    <input
                      aria-label={`Gols de ${awayName}`}
                      className="admin-score-input"
                      inputMode="numeric"
                      min="0"
                      name="awayGoals"
                      type="number"
                      defaultValue={scoreValue(match.awayGoals)}
                    />
                  </label>
                </div>
              </div>
              <div className="admin-form-footer">
                <span className="meta">Jogos com placar salvo descem na lista para priorizar os próximos resultados.</span>
                <button className="button primary" type="submit">Salvar resultado</button>
              </div>
            </form>
            <details className="admin-override-panel">
              <summary>Correção auditada</summary>
              <form className="admin-confirm-form" action={`/api/admin/matches/${match.id}/override-result`} method="post">
                <label><span>Gols mandante</span><input name="homeGoals" type="number" min="0" defaultValue={scoreValue(match.homeGoals)} /></label>
                <label><span>Gols visitante</span><input name="awayGoals" type="number" min="0" defaultValue={scoreValue(match.awayGoals)} /></label>
                <label>
                  <span>Override auditado</span>
                  <input name="confirmation" placeholder="CONFIRMAR" />
                </label>
                <small>Digite CONFIRMAR para marcar o jogo como Encerrado e recalcular o ranking.</small>
                <button className="button" type="submit">Forçar resultado e recalcular</button>
              </form>
            </details>
          </article>
          );
        })}
      </section>
    </main>
  );
}
