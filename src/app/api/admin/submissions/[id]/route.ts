import { NextRequest } from "next/server";

import { writeAuditLog } from "@/lib/admin/audit";
import {
  redirectBackWithMessage,
  requireAdminApi,
  shouldRedirectBack,
} from "@/lib/admin/auth";
import { asString, readRequestData } from "@/lib/admin/forms";
import { prisma } from "@/lib/prisma";

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

  const after = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.admin_override', 'on', true)`;
    await tx.matchPrediction.updateMany({
      where: { submissionId: id },
      data: { confirmedAt: null },
    });
    await tx.placementPrediction.updateMany({
      where: { submissionId: id },
      data: { confirmedAt: null },
    });

    return tx.predictionSubmission.update({
      where: { id },
      data: {
        status: "draft",
        confirmedAt: null,
      },
    });
  });

  await writeAuditLog({
    actorUserId: user.id,
    action: "submission.unlock",
    targetEntity: "prediction_submission",
    targetId: id,
    before,
    after,
  });

  if (shouldRedirectBack(request)) {
    return redirectBackWithMessage(
      request,
      "/admin/submissions",
      "mensagem",
      "Envio desbloqueado. O jogador já pode editar e reenviar os palpites.",
    );
  }

  return Response.json({ ok: true, submission: after });
}
