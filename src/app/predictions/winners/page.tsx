import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getPlacementPredictionState,
  placementLabels,
} from "@/lib/predictions/placement";
import { WinnersPredictionForm } from "./winners-prediction-form";

export const dynamic = "force-dynamic";

function formatDeadline(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(value);
}

export default async function WinnersPredictionsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const state = await getPlacementPredictionState(user.id);
  const initialPlacements = Object.fromEntries(
    state.placementKinds.map((placement) => [
      placement,
      state.predictionByPlacement.get(placement)?.teamId ?? "",
    ]),
  ) as Record<(typeof state.placementKinds)[number], string>;

  return (
    <main className="matches-page">
      <WinnersPredictionForm
        deadlineLabel={formatDeadline(state.deadline)}
        initialPlacements={initialPlacements}
        isConfirmed={state.isConfirmed}
        isOpen={state.window.isOpen}
        placements={state.placementKinds.map((placement) => ({
          key: placement,
          label: placementLabels[placement],
        }))}
        teams={state.teams}
      />
    </main>
  );
}
