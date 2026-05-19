import { NextRequest } from "next/server";

import { requireAdminApi } from "@/lib/admin/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { response } = await requireAdminApi(request);

  if (response) {
    return response;
  }

  const submissions = await prisma.predictionSubmission.findMany({
    include: {
      user: {
        select: {
          displayName: true,
          username: true,
        },
      },
      _count: {
        select: {
          matchPredictions: true,
          placementPredictions: true,
        },
      },
    },
    orderBy: [{ phaseGroup: "asc" }, { updatedAt: "desc" }],
  });

  return Response.json({ submissions });
}
