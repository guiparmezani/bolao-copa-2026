import { NextRequest } from "next/server";
import { formError, redirectTo, requireSameOrigin } from "@/lib/auth/http";
import { clearSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) {
    return formError("Requisição inválida.", 403);
  }

  await clearSession();

  return redirectTo(request, "/");
}
