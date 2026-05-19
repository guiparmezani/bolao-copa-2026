export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string) {
  const normalized = normalizeEmail(email);

  if (!normalized || normalized.length > 254) {
    return {
      ok: false as const,
      error: "Informe um email válido.",
    };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return {
      ok: false as const,
      error: "Informe um email válido.",
    };
  }

  return { ok: true as const, normalized };
}
