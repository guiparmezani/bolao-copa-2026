import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

type LoginPageProps = {
  searchParams: Promise<{ erro?: string; mensagem?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect(user.role === "admin" ? "/admin" : "/dashboard");
  }

  const { erro, mensagem } = await searchParams;

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
          {mensagem ? <p className="prediction-message">{mensagem}</p> : null}
          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              name="email"
              required
              type="email"
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
        <p className="meta auth-card-note">Cadastro encerrado para novos participantes.</p>
      </section>
    </main>
  );
}
