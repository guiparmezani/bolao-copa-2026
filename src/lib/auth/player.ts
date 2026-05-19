import "server-only";

import type { User } from "@prisma/client";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";

export async function requirePlayerPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "admin") {
    redirect("/admin");
  }

  return user;
}

export function playerOnlyApiError(user: User | null) {
  if (!user) {
    return Response.json({ error: "Faça login para enviar palpites." }, { status: 401 });
  }

  if (user.role === "admin") {
    return Response.json(
      { error: "Administradores não podem enviar palpites." },
      { status: 403 },
    );
  }

  return null;
}
