import { NextRequest } from "next/server";

import { writeAuditLog } from "@/lib/admin/audit";
import {
  redirectBackWithMessage,
  requireAdminApi,
  shouldRedirectBack,
} from "@/lib/admin/auth";
import { asString, readRequestData } from "@/lib/admin/forms";
import { prisma } from "@/lib/prisma";
import { isBeforeOrAtDeadline } from "@/lib/predictions/deadlines";
import { getPlacementPredictionDeadline } from "@/lib/predictions/placement";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  return updateSubmission(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return updateSubmission(request, context);
}

async function updateSubmission(request: NextRequest, context: RouteContext) {
  const { response, user } = await requireAdminApi(request, true);

  if (response || !user) {
    return response;
  }

  const { id } = await context.params;
  const data = await readRequestData(request);
  const before = await prisma.predictionSubmission.findUnique({ where: { id } });

  if (!before) {
    if (shouldRedirectBack(request)) {
      return redirectBackWithMessage(
        request,
        "/admin/submissions",
        "erro",
        "Envio não encontrado.",
      );
    }

    return Response.json({ error: "Envio não encontrado." }, { status: 404 });
  }

  if (asString(data.confirmation) !== "DESBLOQUEAR") {
    if (shouldRedirectBack(request)) {
      return redirectBackWithMessage(
        request,
        "/admin/submissions",
        "erro",
        "Digite DESBLOQUEAR para abrir este envio.",
      );
    }

    return Response.json({ error: "Digite DESBLOQUEAR para abrir este envio." }, { status: 400 });
  }

  const placementDeadline = await getPlacementPredictionDeadline();
  const shouldUnlockPlacement =
    before.phaseGroup === "group" && isBeforeOrAtDeadline(new Date(), placementDeadline);
  const linkedPlacementBefore = shouldUnlockPlacement
    ? await prisma.predictionSubmission.findUnique({
        where: {
          userId_phaseGroup: {
            phaseGroup: "placement",
            userId: before.userId,
          },
        },
      })
    : null;

  const { after, linkedPlacementAfter, linkedPlacementUnlocked } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.admin_override', 'on', true)`;
    await tx.matchPrediction.updateMany({
      where: { submissionId: id },
      data: { confirmedAt: null },
    });
    await tx.placementPrediction.updateMany({
      where: { submissionId: id },
      data: { confirmedAt: null },
    });

    const after = await tx.predictionSubmission.update({
      where: { id },
      data: {
        status: "draft",
        confirmedAt: null,
      },
    });

    let linkedPlacementAfter = null;
    let linkedPlacementUnlocked = false;

    if (linkedPlacementBefore?.status === "confirmed") {
      await tx.placementPrediction.updateMany({
        where: { submissionId: linkedPlacementBefore.id },
        data: { confirmedAt: null },
      });

      linkedPlacementAfter = await tx.predictionSubmission.update({
        where: { id: linkedPlacementBefore.id },
        data: {
          confirmedAt: null,
          status: "draft",
        },
      });
      linkedPlacementUnlocked = true;
    }

    return { after, linkedPlacementAfter, linkedPlacementUnlocked };
  });

  await writeAuditLog({
    actorUserId: user.id,
    action: "submission.unlock",
    targetEntity: "prediction_submission",
    targetId: id,
    before: {
      linkedPlacementSubmission: linkedPlacementBefore,
      submission: before,
    },
    after: {
      linkedPlacementSubmission: linkedPlacementAfter,
      submission: after,
    },
  });

  if (shouldRedirectBack(request)) {
    return redirectBackWithMessage(
      request,
      "/admin/submissions",
      "mensagem",
      linkedPlacementUnlocked
        ? "Envio desbloqueado. Os palpites de campeões também foram liberados para este jogador."
        : "Envio desbloqueado. O jogador já pode editar e reenviar os palpites.",
    );
  }

  return Response.json({
    linkedPlacementUnlocked,
    ok: true,
    submission: after,
  });
}
