import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { AuthAttemptKind, AuthAttemptResult } from "@prisma/client";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function formError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function redirectWithError(request: NextRequest, path: string, error: string) {
  const url = new URL(path, getRequestOrigin(request));
  url.searchParams.set("erro", error);
  return NextResponse.redirect(url, { status: 303 });
}

export function getRequestIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local"
  );
}

export function requireSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  return origin === new URL(request.url).origin || origin === getRequestOrigin(request);
}

export function getRequestOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProto ?? new URL(request.url).protocol.replace(":", "");

  if (!host) {
    return new URL(request.url).origin;
  }

  return `${protocol}://${host}`;
}

export function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, getRequestOrigin(request)), {
    status: 303,
  });
}

export async function isRateLimited(
  kind: AuthAttemptKind,
  usernameNormalized: string | null,
  ipAddress: string,
) {
  const since = new Date(Date.now() - WINDOW_MS);
  const identityFilters = usernameNormalized
    ? [{ ipAddress }, { usernameNormalized }]
    : [{ ipAddress }];

  const attempts = await prisma.authAttempt.count({
    where: {
      kind,
      result: { in: ["invalid", "rate_limited"] },
      createdAt: { gte: since },
      OR: identityFilters,
    },
  });

  return attempts >= MAX_ATTEMPTS;
}

export async function recordAuthAttempt(
  kind: AuthAttemptKind,
  result: AuthAttemptResult,
  usernameNormalized: string | null,
  ipAddress: string,
) {
  await prisma.authAttempt.create({
    data: { kind, result, usernameNormalized, ipAddress },
  });
}
