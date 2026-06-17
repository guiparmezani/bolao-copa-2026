import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export default async function SignupPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect(user.role === "admin" ? "/admin" : "/dashboard");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="card-head">
          <div>
            <span className="meta">Cadastro encerrado</span>
            <h1>O bolão já começou</h1>
          </div>
        </div>
        <div className="empty-state">
          <strong>Não estamos aceitando novos participantes.</strong>
          <span>
            As inscrições foram fechadas porque o bolão já começou. Quem já tem
            conta pode entrar normalmente.
          </span>
          <Link className="button primary" href="/login">
            Entrar
          </Link>
        </div>
      </section>
    </main>
  );
}
