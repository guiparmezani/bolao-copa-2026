import { NextRequest } from "next/server";
import { formError, requireSameOrigin } from "@/lib/auth/http";
import { getCurrentUser } from "@/lib/auth/session";
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

  if (!user) {
    return Response.json({ error: "Faça login para confirmar seus palpites." }, { status: 401 });
  }

  try {
    const placements = parsePlacementPayload(await request.json());
    await confirmPlacementPredictions(user.id, placements);

    return Response.json({ ok: true });
  } catch (error) {
    return placementPredictionErrorResponse(error);
  }
}
