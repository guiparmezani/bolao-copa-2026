import { getCurrentUser } from "@/lib/auth/session";
import { getGroupPredictionState, serializePrediction } from "@/lib/predictions/group";
import {
  getKnockoutPredictionState,
  serializeKnockoutPrediction,
} from "@/lib/predictions/knockout";
import {
  getPlacementPredictionState,
  serializePlacementPrediction,
} from "@/lib/predictions/placement";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Faça login para ver seus palpites." }, { status: 401 });
  }

  const [group, knockout, placement] = await Promise.all([
    getGroupPredictionState(user.id),
    getKnockoutPredictionState(user.id),
    getPlacementPredictionState(user.id),
  ]);

  return Response.json({
    group: {
      confirmedAt: group.submission?.confirmedAt?.toISOString() ?? null,
      deadline: group.deadline.toISOString(),
      predictedCount: group.predictedCount,
      publishedMatchCount: group.matches.length,
      status: group.submission?.status ?? "draft",
      predictions: Array.from(group.predictionByMatchId.values()).map(serializePrediction),
    },
    knockout: {
      confirmedAt: knockout.submission?.confirmedAt?.toISOString() ?? null,
      deadline: knockout.deadline.toISOString(),
      isReady: knockout.window.isReady,
      predictedCount: knockout.predictedCount,
      publishedMatchCount: knockout.matches.length,
      status: knockout.submission?.status ?? "draft",
      predictions: Array.from(knockout.predictionByMatchId.values()).map(
        serializeKnockoutPrediction,
      ),
    },
    placement: {
      confirmedAt: placement.submission?.confirmedAt?.toISOString() ?? null,
      deadline: placement.deadline.toISOString(),
      predictedCount: placement.predictedCount,
      requiredCount: placement.placementKinds.length,
      status: placement.submission?.status ?? "draft",
      predictions: Array.from(placement.predictionByPlacement.values()).map(
        serializePlacementPrediction,
      ),
    },
  });
}
