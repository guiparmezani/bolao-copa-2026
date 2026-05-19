import { NextRequest } from "next/server";
import { formError, requireSameOrigin } from "@/lib/auth/http";
import { getCurrentUser } from "@/lib/auth/session";
import {
  parsePredictionPayload,
  predictionErrorResponse,
  saveGroupPredictionDraft,
} from "@/lib/predictions/group";

export async function POST(request: NextRequest) {
  if (!requireSameOrigin(request)) {
    return formError("Requisição inválida.", 403);
  }

  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Faça login para salvar seus palpites." }, { status: 401 });
  }

  try {
    const predictions = parsePredictionPayload(await request.json());
    await saveGroupPredictionDraft(user.id, predictions);

    return Response.json({ ok: true });
  } catch (error) {
    return predictionErrorResponse(error);
  }
}
