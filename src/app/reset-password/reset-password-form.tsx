"use client";

import Link from "next/link";
import { FormEvent, useRef, useState, useTransition } from "react";

type ResetPasswordFormProps = {
  initialError?: string;
  token: string;
};

export function ResetPasswordForm({ initialError, token }: ResetPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [isPending, startTransition] = useTransition();
  const errorRef = useRef<HTMLParagraphElement>(null);

  function showError(message: string) {
    setError(message);
    window.setTimeout(() => {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== passwordConfirmation) {
      showError("As senhas não conferem.");
      return;
    }

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/reset-password", {
          body: formData,
          headers: { accept: "application/json" },
          method: "POST",
        });
        const data = (await response.json()) as { error?: string; redirectTo?: string };

        if (!response.ok) {
          showError(data.error ?? "Não foi possível redefinir sua senha.");
          return;
        }

        window.location.assign(data.redirectTo ?? "/login");
      } catch {
        showError("Não foi possível redefinir sua senha. Tente de novo.");
      }
    });
  }

  return (
    <>
      <form
        action="/api/auth/reset-password"
        className="form"
        method="post"
        onSubmit={handleSubmit}
      >
        <input name="token" type="hidden" value={token} />
        {error ? (
          <p className="form-error" ref={errorRef}>
            {error}
          </p>
        ) : null}
        <label>
          <span>Nova senha</span>
          <input
            autoComplete="new-password"
            minLength={10}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <label>
          <span>Confirmar nova senha</span>
          <input
            autoComplete="new-password"
            minLength={10}
            name="passwordConfirmation"
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            required
            type="password"
            value={passwordConfirmation}
          />
        </label>
        <button className="button primary" disabled={isPending} type="submit">
          Salvar nova senha
        </button>
      </form>
      <div className="auth-switch">
        <span>Lembrou a senha?</span>
        <Link href="/login">Entrar</Link>
      </div>
    </>
  );
}
