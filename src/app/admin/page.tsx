import Link from "next/link";

import { AdminNotice } from "@/components/admin-notice";
import { requireAdminPage } from "@/lib/admin/auth";
import { formatAdminDate } from "@/lib/admin/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getAdminHealth() {
  const [
    users,
    groupConfirmed,
    groupDrafts,
    knockoutConfirmed,
    knockoutDrafts,
    placementConfirmed,
    placementDrafts,
    failedSyncs,
    lastStaticSync,
    lastLiveSync,
    lastLeaderboard,
    finishedMatches,
    scoredMatches,
  ] = await Promise.all([
    prisma.user.count({ where: { status: "active" } }),
    prisma.predictionSubmission.count({ where: { phaseGroup: "group", status: "confirmed" } }),
    prisma.predictionSubmission.count({ where: { phaseGroup: "group", status: "draft" } }),
    prisma.predictionSubmission.count({ where: { phaseGroup: "knockout", status: "confirmed" } }),
    prisma.predictionSubmission.count({ where: { phaseGroup: "knockout", status: "draft" } }),
    prisma.predictionSubmission.count({ where: { phaseGroup: "placement", status: "confirmed" } }),
    prisma.predictionSubmission.count({ where: { phaseGroup: "placement", status: "draft" } }),
    prisma.providerSyncLog.count({ where: { status: "failed" } }),
    prisma.providerSyncLog.findFirst({
      where: { syncType: "static_tournament_data", status: "success" },
      orderBy: { finishedAt: "desc" },
    }),
    prisma.providerSyncLog.findFirst({
      where: { syncType: "live_matches", status: "success" },
      orderBy: { finishedAt: "desc" },
    }),
    prisma.leaderboardSnapshot.findFirst({ orderBy: { computedAt: "desc" } }),
    prisma.match.findMany({
      where: { status: "finished", homeGoals: { not: null }, awayGoals: { not: null } },
      select: { id: true },
    }),
    prisma.matchPredictionScore.findMany({ distinct: ["matchId"], select: { matchId: true } }),
  ]);
  const scoredMatchIds = new Set(scoredMatches.map((score) => score.matchId));

  return {
    users,
    submissions: [
      ["Grupos", groupConfirmed, groupDrafts],
      ["Mata-mata", knockoutConfirmed, knockoutDrafts],
      ["Colocações", placementConfirmed, placementDrafts],
    ] as const,
    failedSyncs,
    lastStaticSync,
    lastLiveSync,
    lastLeaderboard,
    matchesFinishedButNotScored: finishedMatches.filter((match) => !scoredMatchIds.has(match.id))
      .length,
  };
}

type AdminPageProps = {
  searchParams?: Promise<{ aviso?: string; erro?: string; mensagem?: string }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const user = await requireAdminPage();
  const { aviso, erro, mensagem } = (await searchParams) ?? {};
  const health = await getAdminHealth();

  return (
    <main className="admin-page">
      <section className="matches-header">
        <div>
          <span className="chip">Admin</span>
          <h1>Painel do bolão</h1>
          <p>
            Operações restritas para {user.displayName}. Todas as mutações
            registram auditoria.
          </p>
        </div>
        <nav className="admin-nav" aria-label="Admin">
          <Link className="button" href="/admin/matches">Jogos</Link>
          <Link className="button" href="/admin/users">Usuários</Link>
          <Link className="button" href="/admin/submissions">Envios</Link>
          <Link className="button" href="/admin/scoring">Pontuação</Link>
          <Link className="button" href="/admin/settings">Config</Link>
          <Link className="button" href="/admin/audit">Auditoria</Link>
        </nav>
      </section>
      <AdminNotice aviso={aviso} erro={erro} mensagem={mensagem} />

      <section className="layout">
        <article className="card">
          <div className="card-head">
            <h2>Status de dados</h2>
            <span className="meta">{health.failedSyncs} falhas</span>
          </div>
          <div className="info">
            <strong>Sync estático</strong>
            <span>{formatAdminDate(health.lastStaticSync?.finishedAt)}</span>
            <strong>Sync live</strong>
            <span>{formatAdminDate(health.lastLiveSync?.finishedAt)}</span>
            <strong>Rate limit</strong>
            <span>Não configurado no provider atual.</span>
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <h2>Saúde do bolão</h2>
            <span className="meta">{health.users} usuários ativos</span>
          </div>
          <div className="rules-list">
            {health.submissions.map(([label, confirmed, drafts]) => (
              <div className="rules-row compact" key={label}>
                <strong>{label}</strong>
                <span>{confirmed} confirmados / {drafts} rascunhos</span>
              </div>
            ))}
            <div className="rules-row compact">
              <strong>Jogos encerrados sem score</strong>
              <span>{health.matchesFinishedButNotScored}</span>
            </div>
            <div className="rules-row compact">
              <strong>Ranking recalculado</strong>
              <span>{formatAdminDate(health.lastLeaderboard?.computedAt)}</span>
            </div>
          </div>
        </article>
      </section>

      <section className="card admin-actions">
        <div className="card-head">
          <h2>Ações rápidas</h2>
          <span className="meta">Auditadas</span>
        </div>
        <div className="admin-form-grid">
          <form action="/api/admin/sync/run" method="post">
            <button className="button primary" type="submit">Rodar sync agora</button>
          </form>
          <form action="/api/admin/leaderboard/recompute" method="post">
            <button className="button" type="submit">Recalcular ranking</button>
          </form>
          <form action="/api/admin/matches/bulk-publish" method="post">
            <button className="button" type="submit">Publicar jogos importados</button>
          </form>
          <Link className="button" href="/api/admin/export/predictions">Exportar palpites</Link>
          <Link className="button" href="/api/admin/export/leaderboard">Exportar ranking</Link>
        </div>
      </section>
    </main>
  );
}
