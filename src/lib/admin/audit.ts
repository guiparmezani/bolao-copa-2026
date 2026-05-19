import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type AuditInput = {
  actorUserId: string;
  action: string;
  targetEntity: string;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
};

function asJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function writeAuditLog(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      targetEntity: input.targetEntity,
      targetId: input.targetId ?? null,
      beforePayload: asJson(input.before),
      afterPayload: asJson(input.after),
    },
  });
}
