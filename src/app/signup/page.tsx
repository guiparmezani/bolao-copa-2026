import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

type SignupPageProps = {
  searchParams: Promise<{ erro?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect(user.role === "admin" ? "/admin" : "/dashboard");
  }

  const { erro } = await searchParams;

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="card-head">
          <div>
            <span className="meta">Cadastro aberto</span>
            <h1>Criar conta</h1>
          </div>
        </div>
        <form className="form" action="/api/auth/signup" method="post">
          {erro ? <p className="form-error">{erro}</p> : null}
          <label>
            <span>Nome de exibição</span>
            <input
              autoComplete="name"
              maxLength={80}
              name="displayName"
              required
            />
          </label>
          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              maxLength={254}
              name="email"
              required
              type="email"
            />
            <small>Vamos usar este email para confirmar sua conta e enviar seus palpites.</small>
          </label>
          <label>
            <span>Nome de usuário</span>
            <input
              autoComplete="username"
              inputMode="text"
              maxLength={32}
              minLength={3}
              name="username"
              pattern={"[a-zA-Z0-9_.\\-]+"}
              required
            />
            <small>Use letras, números, ponto, hífen ou sublinhado.</small>
          </label>
          <label>
            <span>Senha</span>
            <input
              autoComplete="new-password"
              minLength={10}
              name="password"
              required
              type="password"
            />
          </label>
          <label>
            <span>Confirmar senha</span>
            <input
              autoComplete="new-password"
              minLength={10}
              name="passwordConfirmation"
              required
              type="password"
            />
          </label>
          <button className="button primary" type="submit">
            Criar conta
          </button>
        </form>
        <div className="auth-switch">
          <span>Já tem conta?</span>
          <Link href="/login">Entrar</Link>
        </div>
      </section>
    </main>
  );
}
