import { NextRequest } from "next/server";
import { formError, requireSameOrigin } from "@/lib/auth/http";
import { playerOnlyApiError } from "@/lib/auth/player";
import { getCurrentUser } from "@/lib/auth/session";
import { sendPredictionSubmissionEmail } from "@/lib/email/messages";
import {
  confirmKnockoutPredictions,
  knockoutPredictionErrorResponse,
  parsePredictionPayload,
} from "@/lib/predictions/knockout";

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
    const predictions = parsePredictionPayload(await request.json());
    const submission = await confirmKnockoutPredictions(user.id, predictions);
    await sendPredictionSubmissionEmail(user.id, "knockout", submission.id).catch((emailError) => {
      console.error("Failed to send knockout prediction email", emailError);
    });

    return Response.json({ ok: true });
  } catch (error) {
    return knockoutPredictionErrorResponse(error);
  }
}
