import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { SignupForm } from "./signup-form";

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
        <SignupForm initialError={erro} />
      </section>
    </main>
  );
}
