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

type AdminMatchesPageProps = {
  searchParams?: Promise<{ aviso?: string; erro?: string; mensagem?: string }>;
};

export default async function AdminMatchesPage({ searchParams }: AdminMatchesPageProps) {
  await requireAdminPage();
  const { aviso, erro, mensagem } = (await searchParams) ?? {};
  const matches = await prisma.match.findMany({
    include: {
      awayTeam: true,
      homeTeam: true,
    },
    orderBy: [{ kickoffAt: "asc" }, { matchNumber: "asc" }],
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

      <section className="card admin-actions">
        <div className="card-head">
          <h2>Novo jogo manual</h2>
          <span className="meta">Fallback sem provider</span>
        </div>
        <form className="admin-form-grid" action="/api/admin/matches" method="post">
          <label><span>Número</span><input name="matchNumber" type="number" required /></label>
          <label><span>Fase</span><select name="phase" defaultValue="group">
            {Object.entries(phaseLabels).map(([phase, label]) => (
              <option key={phase} value={phase}>{label}</option>
            ))}
          </select></label>
          <label><span>Início ISO/UTC</span><input name="kickoffAt" placeholder="2026-06-11T19:00:00.000Z" required /></label>
          <label><span>Grupo</span><input name="groupName" placeholder="Grupo A" /></label>
          <label><span>Estádio</span><input name="venueName" /></label>
          <label><span>Cidade</span><input name="venueCity" /></label>
          <label><span>Mandante/placeholder</span><input name="homePlaceholder" /></label>
          <label><span>Visitante/placeholder</span><input name="awayPlaceholder" /></label>
          <label><span>Publicação</span><select name="publicationStatus" defaultValue="draft">
            <option value="draft">Rascunho</option>
            <option value="published">Publicado</option>
            <option value="archived">Arquivado</option>
          </select></label>
          <button className="button primary" type="submit">Criar jogo</button>
        </form>
      </section>

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
                  <span>Use status Encerrado para pontuar e recalcular o ranking.</span>
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
              <div className="admin-match-fields admin-match-fields-compact">
                <label><span>Status do jogo</span><select name="status" defaultValue={match.status}>
                  {Object.entries(statusLabels).map(([status, label]) => (
                    <option key={status} value={status}>{label}</option>
                  ))}
                </select></label>
              </div>
              <div className="admin-form-footer">
                <span className="meta">O ranking só pontua jogos com status Encerrado e placar completo.</span>
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
