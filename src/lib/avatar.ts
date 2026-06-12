const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export const maxAvatarImageBytes = 256 * 1024;

type AvatarValidationResult =
  | {
      ok: true;
      value: {
        dataUrl: string;
        mimeType: string;
      } | null;
    }
  | {
      error: string;
      ok: false;
    };

function hasExpectedSignature(bytes: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }

  if (mimeType === "image/webp") {
    return bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP";
  }

  return false;
}

export function validateAvatarDataUrl(value: unknown): AvatarValidationResult {
  if (value === null) {
    return { ok: true, value: null };
  }

  if (typeof value !== "string") {
    return { error: "Envie uma imagem válida.", ok: false };
  }

  if (value.length > Math.ceil(maxAvatarImageBytes * 1.4) + 80) {
    return { error: "A imagem ficou grande demais. Tente outra foto.", ok: false };
  }

  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);

  if (!match) {
    return { error: "Use uma imagem JPG, PNG ou WebP.", ok: false };
  }

  const [, mimeType, base64] = match;

  if (!allowedMimeTypes.has(mimeType)) {
    return { error: "Use uma imagem JPG, PNG ou WebP.", ok: false };
  }

  const bytes = Buffer.from(base64, "base64");

  if (bytes.length === 0 || bytes.length > maxAvatarImageBytes) {
    return { error: "A imagem ficou grande demais. Tente outra foto.", ok: false };
  }

  if (!hasExpectedSignature(bytes, mimeType)) {
    return { error: "O arquivo não parece ser uma imagem válida.", ok: false };
  }

  return {
    ok: true,
    value: {
      dataUrl: value,
      mimeType,
    },
  };
}
