import "server-only";

import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

import { formError, requireSameOrigin } from "@/lib/auth/http";
import { getCurrentUser } from "@/lib/auth/session";

export async function requireAdminPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  return user;
}

export async function requireAdminApi(request: NextRequest, mutation = false) {
  if (mutation && !requireSameOrigin(request)) {
    return {
      response: formError("Requisição inválida.", 403),
      user: null,
    };
  }

  const user = await getCurrentUser();

  if (!user) {
    return {
      response: Response.json({ error: "Faça login para acessar o admin." }, { status: 401 }),
      user: null,
    };
  }

  if (user.role !== "admin") {
    return {
      response: Response.json({ error: "Acesso restrito a administradores." }, { status: 403 }),
      user: null,
    };
  }

  return { response: null, user };
}

export function shouldRedirectBack(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data");
}

export function redirectBack(request: NextRequest, fallback = "/admin") {
  const referer = request.headers.get("referer");
  return Response.redirect(referer ?? new URL(fallback, request.url), 303);
}

export function redirectBackWithMessage(
  request: NextRequest,
  fallback: string,
  key: "aviso" | "erro" | "mensagem",
  message: string,
) {
  const referer = request.headers.get("referer");
  const url = new URL(referer ?? fallback, request.url);
  url.searchParams.set(key, message);
  for (const messageKey of ["aviso", "erro", "mensagem"]) {
    if (messageKey !== key) {
      url.searchParams.delete(messageKey);
    }
  }
  return Response.redirect(url, 303);
}
