import Link from "next/link";

import { AdminNotice } from "@/components/admin-notice";
import { requireAdminPage } from "@/lib/admin/auth";
import { formatAdminDate } from "@/lib/admin/format";
import { prisma } from "@/lib/prisma";
import { phaseLabels, statusLabels } from "@/lib/tournament";

export const dynamic = "force-dynamic";

function scoreValue(value: number | null) {
  return value === null ? "" : String(value);
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
          <span className="chip">Admin</span>
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
        {matches.map((match) => (
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
              <label><span>Início</span><input name="kickoffAt" defaultValue={match.kickoffAt.toISOString()} /></label>
              <label><span>Status</span><select name="status" defaultValue={match.status}>
                {Object.entries(statusLabels).map(([status, label]) => (
                  <option key={status} value={status}>{label}</option>
                ))}
              </select></label>
              <label><span>Publicação</span><select name="publicationStatus" defaultValue={match.publicationStatus}>
                <option value="draft">Rascunho</option>
                <option value="published">Publicado</option>
                <option value="archived">Arquivado</option>
              </select></label>
              <label><span>Estádio</span><input name="venueName" defaultValue={match.venueName ?? ""} /></label>
              <label><span>Cidade</span><input name="venueCity" defaultValue={match.venueCity ?? ""} /></label>
              <label><span>Mandante</span><input name="homePlaceholder" defaultValue={match.homeTeam?.namePt ?? match.homePlaceholder ?? ""} /></label>
              <label><span>Visitante</span><input name="awayPlaceholder" defaultValue={match.awayTeam?.namePt ?? match.awayPlaceholder ?? ""} /></label>
              <label><span>Gols mandante</span><input name="homeGoals" type="number" min="0" defaultValue={scoreValue(match.homeGoals)} /></label>
              <label><span>Gols visitante</span><input name="awayGoals" type="number" min="0" defaultValue={scoreValue(match.awayGoals)} /></label>
              <span className="meta">O ranking só pontua jogos com status Encerrado.</span>
              <button className="button" type="submit">Salvar metadados</button>
            </form>
            <form className="admin-confirm-form" action={`/api/admin/matches/${match.id}/override-result`} method="post">
              <label><span>Gols mandante</span><input name="homeGoals" type="number" min="0" defaultValue={scoreValue(match.homeGoals)} /></label>
              <label><span>Gols visitante</span><input name="awayGoals" type="number" min="0" defaultValue={scoreValue(match.awayGoals)} /></label>
              <label>
                <span>Override auditado</span>
                <input name="confirmation" placeholder="CONFIRMAR" />
              </label>
              <small>Digite CONFIRMAR para marcar o jogo como Encerrado e recalcular o ranking.</small>
              <button className="button" type="submit">Forçar resultado e recalcular</button>
              <Link className="button" href={`/api/admin/export/matches`}>Exportar jogos</Link>
            </form>
          </article>
        ))}
      </section>
    </main>
  );
}
