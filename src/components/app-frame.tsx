import Link from "next/link";
import type { ReactNode } from "react";

type SidebarUser = {
  displayName: string;
};

type AppFrameProps = {
  children: ReactNode;
  user: SidebarUser;
};

function SidebarLogout() {
  return (
    <form action="/api/auth/logout" method="post">
      <button className="sidebar-link" type="submit">
        Sair
      </button>
    </form>
  );
}

export function PlayerAppFrame({ children, user }: AppFrameProps) {
  return (
    <div className="app-frame">
      <aside className="app-sidebar" aria-label="Menu do jogador">
        <div className="app-sidebar-heading">
          <span className="meta">Logado como</span>
          <strong>{user.displayName}</strong>
        </div>
        <hr className="app-sidebar-separator" />
        <nav className="app-sidebar-nav" aria-label="Área do jogador">
          <Link href="/dashboard">Painel</Link>
          <Link href="/predictions/group">Enviar palpites</Link>
          <Link href="/predictions/knockout">Mata-mata</Link>
          <Link href="/predictions/winners">Campeões</Link>
          <Link href="/predictions">Comparar</Link>
        </nav>
        <div className="app-sidebar-spacer" aria-hidden="true" />
        <div className="app-sidebar-footer">
          <SidebarLogout />
        </div>
      </aside>
      <div className="app-content">{children}</div>
    </div>
  );
}

export function AdminAppFrame({ children, user }: AppFrameProps) {
  return (
    <div className="app-frame">
      <aside className="app-sidebar" aria-label="Menu administrativo">
        <div className="app-sidebar-heading">
          <span className="meta">Logado como</span>
          <strong>{user.displayName}</strong>
        </div>
        <hr className="app-sidebar-separator" />
        <nav className="app-sidebar-nav" aria-label="Admin">
          <Link href="/admin">Painel</Link>
          <Link href="/admin/matches">Jogos</Link>
          <Link href="/admin/users">Usuários</Link>
          <Link href="/admin/submissions">Envios</Link>
          <Link href="/admin/scoring">Pontuação</Link>
          <Link href="/admin/settings">Configurações</Link>
          <Link href="/admin/audit">Auditoria</Link>
          <Link href="/api/admin/export/predictions">Exportar palpites</Link>
        </nav>
        <div className="app-sidebar-spacer" aria-hidden="true" />
        <div className="app-sidebar-footer">
          <SidebarLogout />
        </div>
      </aside>
      <div className="app-content">{children}</div>
    </div>
  );
}
