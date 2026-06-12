"use client";

import { useState, useTransition } from "react";

type PasswordResetLinkButtonProps = {
  userId: string;
};

type PasswordResetLinkResponse = {
  error?: string;
  expiresAt?: string;
  resetUrl?: string;
};

export function PasswordResetLinkButton({ userId }: PasswordResetLinkButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [resetUrl, setResetUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function generateLink() {
    setStatus(null);
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/users/${userId}/password-reset-link`, {
          method: "POST",
        });
        const data = (await response.json()) as PasswordResetLinkResponse;

        if (!response.ok || !data.resetUrl) {
          setError(data.error ?? "Não foi possível gerar o link.");
          return;
        }

        setResetUrl(data.resetUrl);
        setExpiresAt(data.expiresAt ?? "");
        setStatus("Link gerado. Copie e envie para o usuário.");
      } catch {
        setError("Não foi possível gerar o link.");
      }
    });
  }

  async function copyLink() {
    if (!resetUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(resetUrl);
      setStatus("Link copiado.");
    } catch {
      setError("Não foi possível copiar automaticamente. Copie o link manualmente.");
    }
  }

  return (
    <div className="password-reset-tool">
      <div className="password-reset-actions">
        <button className="button" disabled={isPending} onClick={generateLink} type="button">
          Gerar link de senha
        </button>
        {resetUrl ? (
          <button className="button" disabled={isPending} onClick={copyLink} type="button">
            Copiar link
          </button>
        ) : null}
      </div>
      {resetUrl ? (
        <label>
          <span>Link de redefinição</span>
          <input readOnly value={resetUrl} />
        </label>
      ) : null}
      {expiresAt ? <small>Expira em {expiresAt}.</small> : null}
      {status ? <p className="prediction-message compact-message">{status}</p> : null}
      {error ? <p className="form-error compact-message">{error}</p> : null}
    </div>
  );
}
