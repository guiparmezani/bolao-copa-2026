import { PlayerAppFrame } from "@/components/app-frame";
import { requirePlayerPage } from "@/lib/auth/player";
import {
  getKnockoutPredictionState,
  type KnockoutPhase,
} from "@/lib/predictions/knockout";
import {
  formatBrazilDate,
  formatBrazilTime,
  getBrazilDateKey,
  phaseLabels,
} from "@/lib/tournament";
import { GroupPredictionForm } from "../group/group-prediction-form";

export const dynamic = "force-dynamic";

function teamLabel(
  team: { flagEmoji: string; iso2Code: string | null; namePt: string } | null,
  placeholder: string | null,
) {
  return {
    flag: team?.flagEmoji ?? "□",
    iso2Code: team?.iso2Code ?? null,
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
  const user = await requirePlayerPage();

  const state = await getKnockoutPredictionState(user.id);
  const now = new Date();
  const matches = state.matches.map((match) => {
    const prediction = state.predictionByMatchId.get(match.id);
    const phase = match.phase as KnockoutPhase;
    const deadline = state.deadlines[phase];
    const deadlineOpen = deadline.getTime() >= now.getTime();
    const isConfirmed = Boolean(prediction?.confirmedAt);

    return {
      away: teamLabel(match.awayTeam, match.awayPlaceholder),
      dateKey: getBrazilDateKey(match.kickoffAt),
      dateLabel: formatBrazilDate(match.kickoffAt),
      deadlineLabel: formatDeadline(deadline),
      groupName: null,
      home: teamLabel(match.homeTeam, match.homePlaceholder),
      id: match.id,
      isLocked: isConfirmed || !deadlineOpen,
      lockLabel: isConfirmed ? "Palpite confirmado" : "Prazo encerrado",
      matchNumber: match.matchNumber,
      phaseLabel: phaseLabels[match.phase],
      timeLabel: formatBrazilTime(match.kickoffAt),
      venueLabel: [match.venueName, match.venueCity].filter(Boolean).join(" • "),
    };
  });
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
    <PlayerAppFrame user={user}>
      <main className="matches-page">
        <GroupPredictionForm
          confirmEndpoint="/api/predictions/knockout/confirm"
          deadlineLabel={state.window.isReady ? "" : formatDeadline(state.deadline)}
          description={
            state.window.isReady
              ? "Os jogos do mata-mata aparecem aqui conforme os confrontos forem definidos. Cada fase tem seu próprio prazo."
              : "O formulário será liberado assim que houver ao menos um confronto do mata-mata com os dois times definidos. Prazo previsto:"
          }
          draftEndpoint="/api/predictions/knockout/draft"
          emptyText={
            state.window.isReady
              ? "Nenhum confronto liberado para palpite neste momento."
              : "Aguardando a definição oficial dos confrontos do mata-mata."
          }
          emptyTitle={state.window.isReady ? "Nenhum jogo liberado" : "Mata-mata bloqueado"}
          initialPredictions={initialPredictions}
          isConfirmed={state.isConfirmed}
          isOpen={state.window.isOpen}
          matches={matches}
          title="Palpites do mata-mata"
        />
      </main>
    </PlayerAppFrame>
  );
}
