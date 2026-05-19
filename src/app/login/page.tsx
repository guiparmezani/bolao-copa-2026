import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

type LoginPageProps = {
  searchParams: Promise<{ erro?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  const { erro } = await searchParams;

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="card-head">
          <div>
            <span className="meta">Acesso ao bolão</span>
            <h1>Entrar</h1>
          </div>
        </div>
        <form className="form" action="/api/auth/login" method="post">
          {erro ? <p className="form-error">{erro}</p> : null}
          <label>
            <span>Nome de usuário</span>
            <input
              autoComplete="username"
              inputMode="text"
              name="username"
              pattern="[a-zA-Z0-9_.-]+"
              required
            />
          </label>
          <label>
            <span>Senha</span>
            <input
              autoComplete="current-password"
              minLength={10}
              name="password"
              required
              type="password"
            />
          </label>
          <button className="button primary" type="submit">
            Entrar
          </button>
        </form>
        <div className="auth-switch">
          <span>Ainda não tem conta?</span>
          <Link href="/signup">Criar conta</Link>
        </div>
      </section>
    </main>
  );
}
