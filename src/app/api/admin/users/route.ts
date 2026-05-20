import { NextRequest } from "next/server";
import { Prisma, type User, type UserRole } from "@prisma/client";

import { writeAuditLog } from "@/lib/admin/audit";
import { redirectBack, requireAdminApi, shouldRedirectBack } from "@/lib/admin/auth";
import { asString, readRequestData } from "@/lib/admin/forms";
import { validateEmail } from "@/lib/auth/email-address";
import { hashPassword } from "@/lib/auth/password";
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
  const displayName = asString(data.displayName);
  const email = asString(data.email);
  const password = asString(data.password);
  const emailValidation = validateEmail(email);

  if (!displayName || password.length < 8) {
    return Response.json(
      { error: "Informe nome, email e senha temporária com ao menos 8 caracteres." },
      { status: 400 },
    );
  }

  if (!emailValidation.ok) {
    return Response.json({ error: emailValidation.error }, { status: 400 });
  }

  const normalizedEmail = emailValidation.normalized;
  let created: User;

  try {
    created = await prisma.user.create({
      data: {
        username: normalizedEmail,
        usernameNormalized: normalizedEmail,
        displayName,
        email: normalizedEmail,
        emailNormalized: normalizedEmail,
        emailVerifiedAt: new Date(),
        passwordHash: await hashPassword(password),
        role: parseRole(data.role),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return Response.json({ error: "Esse email já está em uso." }, { status: 409 });
    }

    throw error;
  }

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
