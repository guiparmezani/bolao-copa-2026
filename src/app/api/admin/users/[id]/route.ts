import { NextRequest } from "next/server";
import { Prisma, type User, type UserRole, type UserStatus } from "@prisma/client";

import { writeAuditLog } from "@/lib/admin/audit";
import { redirectBack, requireAdminApi, shouldRedirectBack } from "@/lib/admin/auth";
import { asString, readRequestData } from "@/lib/admin/forms";
import { validateEmail } from "@/lib/auth/email-address";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseRole(value: unknown): UserRole {
  return value === "admin" ? "admin" : "player";
}

function parseStatus(value: unknown): UserStatus {
  if (value === "disabled" || value === "deleted") {
    return value;
  }

  return "active";
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return updateUser(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return updateUser(request, context);
}

async function updateUser(request: NextRequest, context: RouteContext) {
  const { response, user: actor } = await requireAdminApi(request, true);

  if (response || !actor) {
    return response;
  }

  const { id } = await context.params;
  const data = await readRequestData(request);
  const before = await prisma.user.findUnique({ where: { id } });

  if (!before) {
    return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  const displayName = asString(data.displayName);
  const email = asString(data.email);
  const emailValidation = email ? validateEmail(email) : null;
  const status = parseStatus(data.status);

  if (emailValidation && !emailValidation.ok) {
    return Response.json({ error: emailValidation.error }, { status: 400 });
  }

  const normalizedEmail = emailValidation?.ok ? emailValidation.normalized : null;
  let after: User;

  try {
    after = await prisma.user.update({
      where: { id },
      data: {
        username: normalizedEmail ?? before.username,
        usernameNormalized: normalizedEmail ?? before.usernameNormalized,
        displayName: displayName || before.displayName,
        email: normalizedEmail ?? before.email,
        emailNormalized: normalizedEmail ?? before.emailNormalized,
        emailVerifiedAt: normalizedEmail ? new Date() : before.emailVerifiedAt,
        role: parseRole(data.role),
        status,
        deletedAt: status === "deleted" ? new Date() : null,
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

  if (status !== "active") {
    await prisma.session.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await writeAuditLog({
    actorUserId: actor.id,
    action: "user.update",
    targetEntity: "user",
    targetId: id,
    before,
    after,
  });

  if (shouldRedirectBack(request)) {
    return redirectBack(request, "/admin/users");
  }

  return Response.json({ ok: true, user: after });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { response, user: actor } = await requireAdminApi(request, true);

  if (response || !actor) {
    return response;
  }

  const { id } = await context.params;
  const before = await prisma.user.findUnique({ where: { id } });

  if (!before) {
    return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  const after = await prisma.user.update({
    where: { id },
    data: {
      status: "deleted",
      deletedAt: new Date(),
    },
  });
  await prisma.session.updateMany({
    where: { userId: id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await writeAuditLog({
    actorUserId: actor.id,
    action: "user.soft_delete",
    targetEntity: "user",
    targetId: id,
    before,
    after,
  });

  return Response.json({ ok: true, user: after });
}
