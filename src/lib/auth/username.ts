export const USERNAME_PATTERN = /^[a-z0-9_.-]+$/;

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function validateUsername(username: string) {
  const normalized = normalizeUsername(username);

  if (normalized.length < 3 || normalized.length > 32) {
    return {
      ok: false as const,
      error: "Use um nome de usuário com 3 a 32 caracteres.",
    };
  }

  if (!USERNAME_PATTERN.test(normalized)) {
    return {
      ok: false as const,
      error:
        "Use apenas letras minúsculas, números, ponto, hífen ou sublinhado.",
    };
  }

  return { ok: true as const, normalized };
}
