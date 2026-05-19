import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type SyncLogClient = PrismaClient | typeof prisma;

type SyncStatus = "success" | "failed" | "skipped";

type SyncLogInput = {
  providerSource: string;
  syncType: string;
  status: SyncStatus;
  startedAt: Date;
  finishedAt: Date;
  errorMessage?: string | null;
  metadata?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
};

export async function writeProviderSyncLog(
  input: SyncLogInput,
  client: SyncLogClient = prisma,
) {
  return client.providerSyncLog.create({
    data: {
      ...input,
      metadata: input.metadata ?? Prisma.JsonNull,
    },
  });
}

export async function withProviderSyncLog<T>(
  providerSource: string,
  syncType: string,
  run: () => Promise<{ result: T; metadata?: Prisma.InputJsonValue; status?: SyncStatus }>,
  client: SyncLogClient = prisma,
) {
  const startedAt = new Date();

  try {
    const { result, metadata, status = "success" } = await run();
    await writeProviderSyncLog(
      {
        providerSource,
        syncType,
        status,
        startedAt,
        finishedAt: new Date(),
        metadata: metadata ?? Prisma.JsonNull,
      },
      client,
    );

    return result;
  } catch (error) {
    await writeProviderSyncLog(
      {
        providerSource,
        syncType,
        status: "failed",
        startedAt,
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      client,
    );
    throw error;
  }
}
