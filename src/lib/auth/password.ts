import argon2 from "argon2";

export function validatePassword(password: string) {
  if (password.length < 10) {
    return "Use uma senha com pelo menos 10 caracteres.";
  }

  if (password.length > 128) {
    return "Use uma senha com no máximo 128 caracteres.";
  }

  return null;
}

export function hashPassword(password: string) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export function verifyPassword(hash: string, password: string) {
  return argon2.verify(hash, password);
}
