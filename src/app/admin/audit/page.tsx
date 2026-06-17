import Link from "next/link";

import { requireAdminPage } from "@/lib/admin/auth";
import { formatAdminDate } from "@/lib/admin/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  await requireAdminPage();
  const [auditLogs, syncLogs] = await Promise.all([
    prisma.auditLog.findMany({
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.providerSyncLog.findMany({
      orderBy: { startedAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <main className="admin-page">
      <section className="matches-header">
        <div><h1>Auditoria</h1><p>Eventos administrativos, syncs e exports operacionais.</p></div>
        <Link className="button" href="/admin">Voltar ao admin</Link>
      </section>
      <section className="card admin-actions">
        <div className="card-head"><h2>Exports</h2><span className="meta">CSV</span></div>
        <div className="admin-form-grid">
          {["users", "matches", "predictions", "scores", "leaderboard"].map((entity) => (
            <Link className="button" href={`/api/admin/export/${entity}`} key={entity}>{entity}</Link>
          ))}
        </div>
      </section>
      <section className="layout">
        <article className="card">
          <div className="card-head"><h2>Audit logs</h2><span className="meta">{auditLogs.length}</span></div>
          <div className="rules-list">
            {auditLogs.map((log) => (
              <div className="rules-row" key={log.id}>
                <strong>{log.action}</strong>
                <span>{formatAdminDate(log.createdAt)} • {log.actor?.displayName ?? "Sistema"} • {log.targetEntity}{log.targetId ? `/${log.targetId}` : ""}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="card">
          <div className="card-head"><h2>Provider sync</h2><span className="meta">{syncLogs.length}</span></div>
          <div className="rules-list">
            {syncLogs.map((log) => (
              <div className="rules-row" key={log.id}>
                <strong>{log.syncType} • {log.status}</strong>
                <span>{formatAdminDate(log.startedAt)} até {formatAdminDate(log.finishedAt)} • {log.providerSource}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
