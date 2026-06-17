import Link from "next/link";

import { AdminNotice } from "@/components/admin-notice";
import { UserIdentity } from "@/components/user-avatar";
import { requireAdminPage } from "@/lib/admin/auth";
import { formatAdminDate } from "@/lib/admin/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const phaseGroupLabels = {
  group: "Grupos",
  knockout: "Mata-mata",
  placement: "Colocações",
} as const;

type AdminSubmissionsPageProps = {
  searchParams?: Promise<{ aviso?: string; erro?: string; mensagem?: string }>;
};

export default async function AdminSubmissionsPage({
  searchParams,
}: AdminSubmissionsPageProps) {
  await requireAdminPage();
  const { aviso, erro, mensagem } = (await searchParams) ?? {};
  const submissions = await prisma.predictionSubmission.findMany({
    include: {
      user: true,
      _count: {
        select: { matchPredictions: true, placementPredictions: true },
      },
    },
    orderBy: [{ phaseGroup: "asc" }, { updatedAt: "desc" }],
  });

  return (
    <main className="admin-page">
      <section className="matches-header">
        <div><h1>Envios</h1><p>Status de envio por jogador e suporte auditado.</p></div>
        <Link className="button" href="/admin">Voltar ao admin</Link>
      </section>
      <AdminNotice aviso={aviso} erro={erro} mensagem={mensagem} />
      <section className="schedule-list">
        {submissions.map((submission) => (
          <article className="card" key={submission.id}>
            <div className="card-head">
              <h2>
                <UserIdentity avatarSize="md" user={submission.user} />
              </h2>
              <span className="meta">{phaseGroupLabels[submission.phaseGroup]} • {submission.status}</span>
            </div>
            <div className="rules-list">
              <div className="rules-row compact"><strong>Confirmado</strong><span>{formatAdminDate(submission.confirmedAt)}</span></div>
              <div className="rules-row compact"><strong>Atualizado</strong><span>{formatAdminDate(submission.updatedAt)}</span></div>
              <div className="rules-row compact"><strong>Itens</strong><span>{submission._count.matchPredictions} jogos / {submission._count.placementPredictions} finais</span></div>
            </div>
            {submission.status === "confirmed" ? (
              <form className="admin-confirm-form" action={`/api/admin/submissions/${submission.id}`} method="post">
                <label>
                  <span>Desbloqueio auditado</span>
                  <input
                    autoComplete="off"
                    name="confirmation"
                    pattern="DESBLOQUEAR"
                    placeholder="DESBLOQUEAR"
                    required
                    title="Digite DESBLOQUEAR em letras maiúsculas."
                  />
                  <small>Digite DESBLOQUEAR para liberar este envio.</small>
                </label>
                <button className="button" type="submit">Desbloquear envio</button>
              </form>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
