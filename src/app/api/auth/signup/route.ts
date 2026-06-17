import { NextRequest } from "next/server";

import {
  formError,
  redirectWithError,
  requireSameOrigin,
} from "@/lib/auth/http";

const signupClosedMessage = "Cadastros encerrados. O bolão já começou.";

function wantsJson(request: NextRequest) {
  return request.headers.get("accept")?.includes("application/json") ?? false;
}

function signupClosed(request: NextRequest) {
  if (wantsJson(request)) {
    return Response.json({ error: signupClosedMessage }, { status: 403 });
  }

  return redirectWithError(request, "/signup", signupClosedMessage);
}

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) {
    return formError("Requisição inválida.", 403);
  }

  return signupClosed(request);
}
