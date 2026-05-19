import { NextRequest } from "next/server";
import { formError, requireSameOrigin } from "@/lib/auth/http";
import { playerOnlyApiError } from "@/lib/auth/player";
import { getCurrentUser } from "@/lib/auth/session";
import { sendPredictionSubmissionEmail } from "@/lib/email/messages";
import {
  confirmPlacementPredictions,
  parsePlacementPayload,
  placementPredictionErrorResponse,
} from "@/lib/predictions/placement";

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) {
    return formError("Requisição inválida.", 403);
  }

  const user = await getCurrentUser();
  const playerError = playerOnlyApiError(user);

  if (playerError) {
    return playerError;
  }

  if (!user) {
    return Response.json({ error: "Faça login para enviar seus palpites." }, { status: 401 });
  }

  try {
    const placements = parsePlacementPayload(await request.json());
    const submission = await confirmPlacementPredictions(user.id, placements);
    await sendPredictionSubmissionEmail(user.id, "placement", submission.id).catch((emailError) => {
      console.error("Failed to send placement prediction email", emailError);
    });

    return Response.json({ ok: true });
  } catch (error) {
    return placementPredictionErrorResponse(error);
  }
}
