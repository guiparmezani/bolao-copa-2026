import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getGroupPredictionState } from "@/lib/predictions/group";
import {
  formatBrazilDate,
  formatBrazilTime,
  getBrazilDateKey,
  phaseLabels,
} from "@/lib/tournament";
import { GroupPredictionForm } from "./group-prediction-form";

export const dynamic = "force-dynamic";

function teamLabel(
  team: { flagEmoji: string; namePt: string } | null,
  placeholder: string | null,
) {
  return {
    flag: team?.flagEmoji ?? "□",
    name: team?.namePt ?? placeholder ?? "A definir",
  };
}

function formatDeadline(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(value);
}

export default async function GroupPredictionsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const state = await getGroupPredictionState(user.id);
  const matches = state.matches.map((match) => ({
    away: teamLabel(match.awayTeam, match.awayPlaceholder),
    dateKey: getBrazilDateKey(match.kickoffAt),
    dateLabel: formatBrazilDate(match.kickoffAt),
    groupName: match.groupName,
    home: teamLabel(match.homeTeam, match.homePlaceholder),
    id: match.id,
    matchNumber: match.matchNumber,
    phaseLabel: phaseLabels[match.phase],
    timeLabel: formatBrazilTime(match.kickoffAt),
    venueLabel: [match.venueName, match.venueCity].filter(Boolean).join(" • "),
  }));
  const initialPredictions = Object.fromEntries(
    Array.from(state.predictionByMatchId.entries()).map(([matchId, prediction]) => [
      matchId,
      {
        awayGoals: String(prediction.awayGoals),
        homeGoals: String(prediction.homeGoals),
      },
    ]),
  );

  return (
    <main className="matches-page">
      <GroupPredictionForm
        deadlineLabel={formatDeadline(state.deadline)}
        initialPredictions={initialPredictions}
        isConfirmed={state.isConfirmed}
        isOpen={state.window.isOpen}
        matches={matches}
      />
    </main>
  );
}
