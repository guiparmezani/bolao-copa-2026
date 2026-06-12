import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { hashPasswordResetToken } from "@/lib/auth/password-reset";
import { ResetPasswordForm } from "./reset-password-form";

export const dynamic = "force-dynamic";

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    erro?: string;
    token?: string;
  }>;
};

async function getResetUser(token: string | undefined) {
  if (!token) {
    return null;
  }

  return prisma.user.findFirst({
    where: {
      passwordResetTokenExpiresAt: {
        gt: new Date(),
      },
      passwordResetTokenHash: hashPasswordResetToken(token),
      status: "active",
    },
    select: {
      displayName: true,
      email: true,
    },
  });
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = (await searchParams) ?? {};
  const user = await getResetUser(params.token);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="card-head">
          <div>
            <span className="meta">Redefinição de senha</span>
            <h1>Nova senha</h1>
          </div>
        </div>
        {user && params.token ? (
          <>
            <div className="auth-intro">
              <strong>{user.displayName}</strong>
              <span>{user.email}</span>
            </div>
            <ResetPasswordForm initialError={params.erro} token={params.token} />
          </>
        ) : (
          <>
            <div className="form auth-invalid-state">
              <p className="form-error">
                Link de redefinição inválido ou expirado. Peça um novo link ao
                administrador do bolão.
              </p>
            </div>
            <div className="auth-switch">
              <span>Já tem acesso?</span>
              <Link href="/login">Entrar</Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
