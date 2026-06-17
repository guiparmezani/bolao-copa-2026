"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";

import { UserAvatar } from "@/components/user-avatar";

const maxSourceImageBytes = 8 * 1024 * 1024;
const avatarSize = 256;

type AvatarUploaderProps = {
  displayName: string;
  initialAvatarImageDataUrl: string | null;
  userId: string;
};

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível abrir essa imagem."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Não foi possível preparar essa imagem."));
      },
      "image/webp",
      0.84,
    );
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler essa imagem."));
    reader.readAsDataURL(blob);
  });
}

async function resizeAvatar(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Use uma imagem JPG, PNG ou WebP.");
  }

  if (file.size > maxSourceImageBytes) {
    throw new Error("Escolha uma imagem com até 8 MB.");
  }

  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Seu navegador não conseguiu preparar essa imagem.");
  }

  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = (image.naturalWidth - sourceSize) / 2;
  const sourceY = (image.naturalHeight - sourceSize) / 2;

  canvas.width = avatarSize;
  canvas.height = avatarSize;
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    avatarSize,
    avatarSize,
  );

  return blobToDataUrl(await canvasToBlob(canvas));
}

async function saveAvatar(avatarDataUrl: string | null) {
  const response = await fetch("/api/me/avatar", {
    body: JSON.stringify({ avatarDataUrl }),
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = (await response.json()) as {
    avatarImageDataUrl?: string | null;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Não foi possível salvar seu avatar.");
  }

  return data.avatarImageDataUrl ?? null;
}

export function AvatarUploader({
  displayName,
  initialAvatarImageDataUrl,
  userId,
}: AvatarUploaderProps) {
  const [avatarImageDataUrl, setAvatarImageDataUrl] = useState(initialAvatarImageDataUrl);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setError(null);
    setStatus(null);
    setIsBusy(true);

    try {
      const nextAvatar = await resizeAvatar(file);
      const savedAvatar = await saveAvatar(nextAvatar);
      setAvatarImageDataUrl(savedAvatar);
      setStatus("Avatar salvo.");
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Não foi possível salvar.");
    } finally {
      setIsBusy(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function handleRemove() {
    setError(null);
    setStatus(null);
    setIsBusy(true);

    try {
      await saveAvatar(null);
      setAvatarImageDataUrl(null);
      setStatus("Avatar removido.");
      router.refresh();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Não foi possível remover.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <article className="card avatar-card" aria-labelledby="avatar-card-title">
      <div className="card-head">
        <div>
          <h2 id="avatar-card-title">Avatar</h2>
          <span className="meta">Imagem pública ao lado do seu nome</span>
        </div>
      </div>
      <div className="avatar-uploader">
        <UserAvatar
          className="avatar-preview"
          size="lg"
          user={{ avatarImageDataUrl, displayName }}
        />
        <div className="avatar-uploader-body">
          <Link className="player-name-link" href={`/predictions?usuario=${userId}`}>
            <strong>{displayName}</strong>
          </Link>
          <span>Use uma imagem quadrada ou uma foto com o rosto centralizado.</span>
          <div className="avatar-actions">
            <label className="button primary">
              Escolher imagem
              <input
                accept="image/jpeg,image/png,image/webp"
                disabled={isBusy}
                onChange={handleFileChange}
                ref={inputRef}
                type="file"
              />
            </label>
            <button
              className="button"
              disabled={isBusy || !avatarImageDataUrl}
              onClick={handleRemove}
              type="button"
            >
              Remover
            </button>
          </div>
          <small>JPG, PNG ou WebP. A imagem é cortada em quadrado automaticamente.</small>
          {error ? <p className="form-error compact-message">{error}</p> : null}
          {status ? <p className="prediction-message compact-message">{status}</p> : null}
        </div>
      </div>
    </article>
  );
}
