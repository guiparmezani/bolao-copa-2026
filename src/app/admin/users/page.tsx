import Link from "next/link";

import { AdminNotice } from "@/components/admin-notice";
import { UserIdentity } from "@/components/user-avatar";
import { requireAdminPage } from "@/lib/admin/auth";
import { formatAdminDate } from "@/lib/admin/format";
import { prisma } from "@/lib/prisma";
import { PasswordResetLinkButton } from "./password-reset-link-button";

export const dynamic = "force-dynamic";

type AdminUsersPageProps = {
  searchParams?: Promise<{ aviso?: string; erro?: string; mensagem?: string }>;
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  await requireAdminPage();
  const { aviso, erro, mensagem } = (await searchParams) ?? {};
  const users = await prisma.user.findMany({
    include: {
      predictionSubmissions: true,
      _count: { select: { matchPredictions: true, placementPredictions: true, sessions: true } },
    },
    orderBy: [{ status: "asc" }, { displayName: "asc" }],
  });

  return (
    <main className="admin-page">
      <section className="matches-header">
        <div><h1>Usuários</h1><p>Criação, status, papel e suporte de acesso.</p></div>
        <Link className="button" href="/admin">Voltar ao admin</Link>
      </section>
      <AdminNotice aviso={aviso} erro={erro} mensagem={mensagem} />
      <section className="card admin-actions">
        <div className="card-head"><h2>Novo usuário</h2><span className="meta">Senha temporária</span></div>
        <form className="admin-form-grid" action="/api/admin/users" method="post">
          <label><span>Nome</span><input name="displayName" required /></label>
          <label><span>Email</span><input name="email" required type="email" /></label>
          <label><span>Senha temporária</span><input name="password" minLength={10} required /></label>
          <label><span>Papel</span><select name="role" defaultValue="player"><option value="player">Jogador</option><option value="admin">Admin</option></select></label>
          <button className="button primary" type="submit">Criar</button>
        </form>
      </section>
      <section className="schedule-list">
        {users.map((user) => (
          <article className="card" key={user.id}>
            <div className="card-head">
              <h2>
                <UserIdentity avatarSize="md" user={user} />
              </h2>
              <span className="meta">{user.email ?? "Email não definido"} • {user.status}</span>
            </div>
            <form className="admin-form-grid" action={`/api/admin/users/${user.id}`} method="post">
              <label><span>Nome</span><input name="displayName" defaultValue={user.displayName} /></label>
              <label><span>Email</span><input name="email" required type="email" defaultValue={user.email ?? ""} /></label>
              <label><span>Papel</span><select name="role" defaultValue={user.role}><option value="player">Jogador</option><option value="admin">Admin</option></select></label>
              <label><span>Status</span><select name="status" defaultValue={user.status}><option value="active">Ativo</option><option value="disabled">Desativado</option><option value="deleted">Removido</option></select></label>
              <button className="button" type="submit">Salvar</button>
            </form>
            <div className="info compact-info">
              <span>
                Criado em {formatAdminDate(user.createdAt)}. {user.predictionSubmissions.length} envios, {user._count.matchPredictions} palpites de jogos, {user._count.placementPredictions} palpites finais, {user._count.sessions} sessões.
              </span>
            </div>
            <PasswordResetLinkButton userId={user.id} />
          </article>
        ))}
      </section>
    </main>
  );
}
