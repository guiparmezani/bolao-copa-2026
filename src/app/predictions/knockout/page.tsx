import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getKnockoutPredictionState } from "@/lib/predictions/knockout";
import {
  formatBrazilDate,
  formatBrazilTime,
  getBrazilDateKey,
  phaseLabels,
} from "@/lib/tournament";
import { GroupPredictionForm } from "../group/group-prediction-form";

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

export default async function KnockoutPredictionsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const state = await getKnockoutPredictionState(user.id);
  const matches = state.window.isReady
    ? state.matches.map((match) => ({
        away: teamLabel(match.awayTeam, match.awayPlaceholder),
        dateKey: getBrazilDateKey(match.kickoffAt),
        dateLabel: formatBrazilDate(match.kickoffAt),
        groupName: null,
        home: teamLabel(match.homeTeam, match.homePlaceholder),
        id: match.id,
        matchNumber: match.matchNumber,
        phaseLabel: phaseLabels[match.phase],
        timeLabel: formatBrazilTime(match.kickoffAt),
        venueLabel: [match.venueName, match.venueCity].filter(Boolean).join(" • "),
      }))
    : [];
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
        confirmEndpoint="/api/predictions/knockout/confirm"
        deadlineLabel={formatDeadline(state.deadline)}
        description={
          state.window.isReady
            ? "Informe os placares do mata-mata. O rascunho pode ser alterado até a confirmação ou até o prazo:"
            : "O formulário será liberado quando todos os confrontos dos 16 avos estiverem definidos. Prazo previsto:"
        }
        draftEndpoint="/api/predictions/knockout/draft"
        emptyText={
          state.window.isReady
            ? "O mata-mata ainda não tem partidas publicadas para palpite."
            : "Aguardando a confirmação oficial dos confrontos dos 16 avos de final."
        }
        emptyTitle={state.window.isReady ? "Nenhum jogo publicado" : "Mata-mata bloqueado"}
        initialPredictions={initialPredictions}
        isConfirmed={state.isConfirmed}
        isOpen={state.window.isOpen}
        matches={matches}
        title="Palpites do mata-mata"
      />
    </main>
  );
}
