import { redirect } from "next/navigation";
import Link from "next/link";
import { PlayerAppFrame } from "@/components/app-frame";
import { TeamFlag, TeamLabel } from "@/components/team-flag";
import { UserIdentity } from "@/components/user-avatar";
import { getCurrentUser } from "@/lib/auth/session";
import { getKnockoutPredictionState } from "@/lib/predictions/knockout";
import {
  getPlacementPredictionState,
  placementLabels,
} from "@/lib/predictions/placement";
import { getGroupPredictionState } from "@/lib/predictions/group";
import {
  formatBrazilDate,
  formatBrazilTime,
  phaseLabels,
} from "@/lib/tournament";
import { AvatarUploader } from "./avatar-uploader";

function formatDeadline(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(value);
}

function getTeamName(
  team: { flagEmoji: string; namePt: string } | null,
  placeholder: string | null,
  flagPosition: "before" | "after",
) {
  if (!team) {
    return placeholder ?? "A definir";
  }

  return <TeamLabel flagPosition={flagPosition} team={team} />;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "admin") {
    redirect("/admin");
  }

  const groupPredictions = await getGroupPredictionState(user.id);
  const knockoutPredictions = await getKnockoutPredictionState(user.id);
  const placementPredictions = await getPlacementPredictionState(user.id);
  const canEditGroup = groupPredictions.window.isOpen && !groupPredictions.isConfirmed;
  const canEditKnockout = knockoutPredictions.window.isOpen && !knockoutPredictions.isConfirmed;
  const canEditPlacement = placementPredictions.window.isOpen && !placementPredictions.isConfirmed;
  const visibleConfirmedPredictions = groupPredictions.isConfirmed
    ? groupPredictions.matches
        .map((match) => ({
          match,
          prediction: groupPredictions.predictionByMatchId.get(match.id),
        }))
        .filter((entry) => entry.prediction)
    : [];

  return (
    <PlayerAppFrame user={user}>
      <main className="dashboard-page">
      <section className="dashboard-header">
        <div>
          <span className="chip">Área protegida</span>
          <h1>
            Olá, <UserIdentity avatarSize="md" user={user} />
          </h1>
          <p>
            Acompanhe o status dos seus envios e revise os palpites já
            confirmados.
          </p>
        </div>
      </section>

      <section className="layout dashboard-grid">
        <AvatarUploader
          displayName={user.displayName}
          initialAvatarImageDataUrl={user.avatarImageDataUrl}
        />

        <article className="card">
          <div className="card-head">
            <h2>Palpites da fase de grupos</h2>
            <span className="meta">
              {groupPredictions.isConfirmed
                ? "Confirmado"
                : canEditGroup
                  ? "Rascunho aberto"
                  : "Encerrado"}
            </span>
          </div>
          <div className="info">
            <strong>
              {groupPredictions.predictedCount} de {groupPredictions.matches.length} jogos
              preenchidos
            </strong>
            <span>
              Prazo padrão da fase de grupos:{" "}
              {formatDeadline(groupPredictions.deadline)}.
            </span>
            {groupPredictions.isConfirmed ? (
              <span>
                Envio confirmado em{" "}
                {groupPredictions.submission?.confirmedAt
                  ? formatDeadline(groupPredictions.submission.confirmedAt)
                  : "data indisponível"}
                . Estes palpites estão bloqueados.
              </span>
            ) : (
              <Link
                className={canEditGroup ? "button primary" : "button"}
                href="/predictions/group"
              >
                {canEditGroup ? "Abrir formulário" : "Ver formulário"}
              </Link>
            )}
          </div>
          {visibleConfirmedPredictions.length > 0 ? (
            <div className="dashboard-predictions" aria-label="Palpites confirmados">
              {visibleConfirmedPredictions.map(({ match, prediction }) => (
                <div className="dashboard-prediction-row" key={match.id}>
                  <span className="meta">
                    Jogo {match.matchNumber} • {formatBrazilDate(match.kickoffAt)} •{" "}
                    {formatBrazilTime(match.kickoffAt)} • {phaseLabels[match.phase]}
                  </span>
                  <strong>
                    {getTeamName(match.homeTeam, match.homePlaceholder, "after")}{" "}
                    {prediction?.homeGoals} x {prediction?.awayGoals}{" "}
                    {getTeamName(match.awayTeam, match.awayPlaceholder, "before")}
                  </strong>
                </div>
              ))}
            </div>
          ) : null}
        </article>

        <article className="card">
          <div className="card-head">
            <h2>Mata-mata e campeões</h2>
            <span className="meta">
              {knockoutPredictions.window.statusLabel} / {placementPredictions.window.statusLabel}
            </span>
          </div>
          <div className="info">
            <strong>
              Mata-mata: {knockoutPredictions.predictedCount} de{" "}
              {knockoutPredictions.matches.length} jogos preenchidos
            </strong>
            <span>
              Prazo do mata-mata: {formatDeadline(knockoutPredictions.deadline)}.
            </span>
            {knockoutPredictions.isConfirmed ? (
              <span>
                Envio confirmado em{" "}
                {knockoutPredictions.submission?.confirmedAt
                  ? formatDeadline(knockoutPredictions.submission.confirmedAt)
                  : "data indisponível"}
                . Estes palpites estão bloqueados.
              </span>
            ) : (
              <Link
                className={canEditKnockout ? "button primary" : "button"}
                href="/predictions/knockout"
              >
                {canEditKnockout ? "Palpitar no mata-mata" : "Ver mata-mata"}
              </Link>
            )}
          </div>
          <div className="info compact-info">
            <strong>
              Campeão, vice e terceiro: {placementPredictions.predictedCount} de 3 preenchidos
            </strong>
            <span>
              Prazo das colocações finais: {formatDeadline(placementPredictions.deadline)}.
            </span>
            {placementPredictions.isConfirmed ? (
              <div className="dashboard-predictions" aria-label="Palpites de campeões confirmados">
                {placementPredictions.placementKinds.map((placement) => {
                  const prediction = placementPredictions.predictionByPlacement.get(placement);
                  const team = placementPredictions.teams.find(
                    (candidate) => candidate.id === prediction?.teamId,
                  );

                  return prediction && team ? (
                    <div className="dashboard-prediction-row" key={placement}>
                      <span className="meta">{placementLabels[placement]}</span>
                      <strong>
                        <TeamFlag team={team} /> {team.namePt}
                      </strong>
                    </div>
                  ) : null;
                })}
              </div>
            ) : (
              <Link
                className={canEditPlacement ? "button primary" : "button"}
                href="/predictions/winners"
              >
                {canEditPlacement ? "Escolher campeões" : "Ver campeões"}
              </Link>
            )}
          </div>
        </article>
      </section>
      </main>
    </PlayerAppFrame>
  );
}
