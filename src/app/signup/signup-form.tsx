"use client";

import Link from "next/link";
import { FormEvent, useRef, useState, useTransition } from "react";

type SignupFormState = {
  displayName: string;
  email: string;
  password: string;
  passwordConfirmation: string;
};

type SignupFormProps = {
  initialError?: string;
};

const initialState: SignupFormState = {
  displayName: "",
  email: "",
  password: "",
  passwordConfirmation: "",
};

export function SignupForm({ initialError }: SignupFormProps) {
  const [values, setValues] = useState(initialState);
  const [error, setError] = useState(initialError ?? null);
  const [isPending, startTransition] = useTransition();
  const errorRef = useRef<HTMLParagraphElement>(null);

  function updateValue(field: keyof SignupFormState, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function showError(message: string) {
    setError(message);
    window.setTimeout(() => {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (values.password !== values.passwordConfirmation) {
      showError("As senhas não conferem.");
      return;
    }

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/signup", {
          body: formData,
          headers: { accept: "application/json" },
          method: "POST",
        });
        const data = (await response.json()) as { error?: string; redirectTo?: string };

        if (!response.ok) {
          showError(data.error ?? "Não foi possível criar sua conta.");
          return;
        }

        window.location.assign(data.redirectTo ?? "/dashboard");
      } catch {
        showError("Não foi possível criar sua conta. Tente de novo.");
      }
    });
  }

  return (
    <>
      <form className="form" action="/api/auth/signup" method="post" onSubmit={handleSubmit}>
        {error ? (
          <p className="form-error" ref={errorRef}>
            {error}
          </p>
        ) : null}
        <label>
          <span>Nome de exibição</span>
          <input
            autoComplete="name"
            maxLength={80}
            name="displayName"
            onChange={(event) => updateValue("displayName", event.target.value)}
            required
            value={values.displayName}
          />
        </label>
        <label>
          <span>Email</span>
          <input
            autoComplete="email"
            maxLength={254}
            name="email"
            onChange={(event) => updateValue("email", event.target.value)}
            required
            type="email"
            value={values.email}
          />
          <small>Vamos usar este email para confirmar sua conta e enviar seus palpites.</small>
        </label>
        <label>
          <span>Senha</span>
          <input
            autoComplete="new-password"
            minLength={10}
            name="password"
            onChange={(event) => updateValue("password", event.target.value)}
            required
            type="password"
            value={values.password}
          />
        </label>
        <label>
          <span>Confirmar senha</span>
          <input
            autoComplete="new-password"
            minLength={10}
            name="passwordConfirmation"
            onChange={(event) => updateValue("passwordConfirmation", event.target.value)}
            required
            type="password"
            value={values.passwordConfirmation}
          />
        </label>
        <button className="button primary" disabled={isPending} type="submit">
          Criar conta
        </button>
      </form>
      <div className="auth-switch">
        <span>Já tem conta?</span>
        <Link href="/login">Entrar</Link>
      </div>
    </>
  );
}
