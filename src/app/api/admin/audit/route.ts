import { NextRequest } from "next/server";

import { requireAdminApi } from "@/lib/admin/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { response } = await requireAdminApi(request);

  if (response) {
    return response;
  }

  const logs = await prisma.auditLog.findMany({
    include: {
      actor: {
        select: {
          displayName: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });

  return Response.json({ logs });
}
