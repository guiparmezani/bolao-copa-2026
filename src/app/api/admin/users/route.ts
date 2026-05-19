import { NextRequest } from "next/server";
import type { UserRole } from "@prisma/client";

import { writeAuditLog } from "@/lib/admin/audit";
import { redirectBack, requireAdminApi, shouldRedirectBack } from "@/lib/admin/auth";
import { asString, readRequestData } from "@/lib/admin/forms";
import { validateEmail } from "@/lib/auth/email-address";
import { hashPassword } from "@/lib/auth/password";
import { normalizeUsername } from "@/lib/auth/username";
import { prisma } from "@/lib/prisma";

function parseRole(value: unknown): UserRole {
  return value === "admin" ? "admin" : "player";
}

export async function GET(request: NextRequest) {
  const { response } = await requireAdminApi(request);

  if (response) {
    return response;
  }

  const users = await prisma.user.findMany({
    orderBy: [{ status: "asc" }, { displayName: "asc" }],
    include: {
      predictionSubmissions: true,
      _count: {
        select: {
          matchPredictions: true,
          placementPredictions: true,
          sessions: true,
        },
      },
    },
  });

  return Response.json({ users });
}

export async function POST(request: NextRequest) {
  const { response, user: actor } = await requireAdminApi(request, true);

  if (response || !actor) {
    return response;
  }

  const data = await readRequestData(request);
  const username = asString(data.username);
  const displayName = asString(data.displayName);
  const email = asString(data.email);
  const password = asString(data.password);
  const emailValidation = email ? validateEmail(email) : null;

  if (!username || !displayName || password.length < 8) {
    return Response.json(
      { error: "Informe nome, usuário e senha temporária com ao menos 8 caracteres." },
      { status: 400 },
    );
  }

  if (emailValidation && !emailValidation.ok) {
    return Response.json({ error: emailValidation.error }, { status: 400 });
  }

  const normalizedEmail = emailValidation?.ok ? emailValidation.normalized : null;
  const created = await prisma.user.create({
    data: {
      username,
      usernameNormalized: normalizeUsername(username),
      displayName,
      email: normalizedEmail,
      emailNormalized: normalizedEmail,
      emailVerifiedAt: normalizedEmail ? new Date() : null,
      passwordHash: await hashPassword(password),
      role: parseRole(data.role),
    },
  });

  await writeAuditLog({
    actorUserId: actor.id,
    action: "user.create",
    targetEntity: "user",
    targetId: created.id,
    after: created,
  });

  if (shouldRedirectBack(request)) {
    return redirectBack(request, "/admin/users");
  }

  return Response.json({ ok: true, user: created });
}
