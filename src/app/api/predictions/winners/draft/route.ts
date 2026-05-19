import { NextRequest } from "next/server";
import { formError, requireSameOrigin } from "@/lib/auth/http";
import { playerOnlyApiError } from "@/lib/auth/player";
import { getCurrentUser } from "@/lib/auth/session";
import {
  parsePlacementPayload,
  placementPredictionErrorResponse,
  savePlacementPredictionDraft,
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
    await savePlacementPredictionDraft(user.id, placements);

    return Response.json({ ok: true });
  } catch (error) {
    return placementPredictionErrorResponse(error);
  }
}
