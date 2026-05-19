"use client";

import { useMemo, useState, useTransition } from "react";

type PredictionMatch = {
  away: {
    flag: string;
    name: string;
  };
  dateKey: string;
  dateLabel: string;
  groupName: string | null;
  home: {
    flag: string;
    name: string;
  };
  id: string;
  matchNumber: number;
  phaseLabel: string;
  timeLabel: string;
  venueLabel: string;
};

type PredictionValue = {
  awayGoals: string;
  homeGoals: string;
};

type GroupPredictionFormProps = {
  confirmEndpoint?: string;
  description?: string;
  deadlineLabel: string;
  draftEndpoint?: string;
  emptyTitle?: string;
  emptyText?: string;
  initialPredictions: Record<string, PredictionValue>;
  isConfirmed: boolean;
  isOpen: boolean;
  matches: PredictionMatch[];
  title?: string;
};

function buildInitialValues(
  matches: PredictionMatch[],
  initialPredictions: Record<string, PredictionValue>,
) {
  return Object.fromEntries(
    matches.map((match) => [
      match.id,
      initialPredictions[match.id] ?? { awayGoals: "", homeGoals: "" },
    ]),
  );
}

function toPayload(values: Record<string, PredictionValue>, requireComplete: boolean) {
  return Object.entries(values)
    .filter(([, value]) => {
      if (requireComplete) {
        return true;
      }

      return value.homeGoals !== "" && value.awayGoals !== "";
    })
    .map(([matchId, value]) => {
      const homeGoals = Number(value.homeGoals);
      const awayGoals = Number(value.awayGoals);

      if (
        value.homeGoals === "" ||
        value.awayGoals === "" ||
        !Number.isInteger(homeGoals) ||
        !Number.isInteger(awayGoals) ||
        homeGoals < 0 ||
        awayGoals < 0
      ) {
        throw new Error("Preencha todos os placares com números inteiros maiores ou iguais a zero.");
      }

      return {
        awayGoals,
        homeGoals,
        matchId,
      };
    });
}

export function GroupPredictionForm({
  confirmEndpoint = "/api/predictions/group/confirm",
  description,
  deadlineLabel,
  draftEndpoint = "/api/predictions/group/draft",
  emptyTitle = "Nenhum jogo publicado",
  emptyText = "A fase de grupos ainda não tem partidas abertas para palpite.",
  initialPredictions,
  isConfirmed,
  isOpen,
  matches,
  title = "Palpites da fase de grupos",
}: GroupPredictionFormProps) {
  const [values, setValues] = useState(() => buildInitialValues(matches, initialPredictions));
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [isPending, startTransition] = useTransition();
  const groupedMatches = useMemo(() => {
    return matches.reduce<Record<string, PredictionMatch[]>>((groups, match) => {
      groups[match.dateKey] = [...(groups[match.dateKey] ?? []), match];
      return groups;
    }, {});
  }, [matches]);
  const editable = isOpen && !isConfirmed;

  async function submitDraft(nextValues = values) {
    setError(null);

    try {
      const predictions = toPayload(nextValues, false);
      const response = await fetch(draftEndpoint, {
        body: JSON.stringify({ predictions }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível salvar o rascunho.");
      }

      setStatus("Rascunho salvo.");
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : "Não foi possível salvar.");
    }
  }

  function updateScore(matchId: string, side: "homeGoals" | "awayGoals", score: string) {
    const sanitized = score.replace(/[^\d]/g, "").slice(0, 2);
    const nextValues = {
      ...values,
      [matchId]: {
        ...values[matchId],
        [side]: sanitized,
      },
    };

    setValues(nextValues);
    setStatus("Alterações ainda não salvas.");
  }

  function saveDraft() {
    startTransition(() => {
      void submitDraft();
    });
  }

  function confirmPredictions() {
    startTransition(async () => {
      setError(null);

      try {
        const predictions = toPayload(values, true);
        const response = await fetch(confirmEndpoint, {
          body: JSON.stringify({ predictions }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        });
        const data = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "Não foi possível confirmar seus palpites.");
        }

        window.location.assign("/dashboard");
      } catch (confirmError) {
        setConfirmOpen(false);
        setError(
          confirmError instanceof Error
            ? confirmError.message
            : "Não foi possível confirmar seus palpites.",
        );
      }
    });
  }

  const actionButtons = (
    <>
      <button
        className="button"
        disabled={!editable || isPending}
        onClick={saveDraft}
        type="button"
      >
        Salvar rascunho
      </button>
      <button
        className="button primary"
        disabled={!editable || isPending || matches.length === 0}
        onClick={() => setConfirmOpen(true)}
        type="button"
      >
        Confirmar palpites
      </button>
    </>
  );

  return (
    <>
      <section className="prediction-toolbar">
        <div>
          <span className="chip">{isConfirmed ? "Confirmado" : isOpen ? "Aberto" : "Encerrado"}</span>
          <h1>{title}</h1>
          <p>
            {description ??
              "Informe os placares dos jogos publicados. O rascunho pode ser alterado até a confirmação ou até o prazo:"}{" "}
            {deadlineLabel}.
          </p>
        </div>
        <div className="prediction-actions">{actionButtons}</div>
      </section>

      {status || error ? (
        <div className={error ? "form-error prediction-message" : "prediction-message"}>
          {error ?? status}
        </div>
      ) : null}

      <section className="schedule-list prediction-list" aria-label="Jogos para palpitar">
        {matches.length === 0 ? (
          <article className="card empty-state">
            <strong>{emptyTitle}</strong>
            <span>{emptyText}</span>
          </article>
        ) : (
          Object.entries(groupedMatches).map(([dateKey, dayMatches]) => (
            <article className="schedule-day" key={dateKey}>
              <div className="schedule-day-head">
                <h2>{dayMatches[0].dateLabel}</h2>
                <span className="meta">{dayMatches.length} jogos</span>
              </div>
              <div className="schedule-day-matches">
                {dayMatches.map((match) => {
                  const value = values[match.id] ?? { awayGoals: "", homeGoals: "" };

                  return (
                    <div className="prediction-match" key={match.id}>
                      <div className="match-meta-line">
                        <span>Jogo {match.matchNumber}</span>
                        <span>{match.timeLabel}</span>
                        <span>{match.phaseLabel}</span>
                        {match.groupName ? <span>{match.groupName}</span> : null}
                      </div>
                      <div className="prediction-score-line">
                        <span className="schedule-team">
                          <span aria-hidden="true">{match.home.flag}</span>
                          <strong>{match.home.name}</strong>
                        </span>
                        <input
                          aria-label={`Gols de ${match.home.name}`}
                          disabled={!editable}
                          inputMode="numeric"
                          min="0"
                          name={`home-${match.id}`}
                          onBlur={() => {
                            if (editable && value.homeGoals !== "" && value.awayGoals !== "") {
                              void submitDraft();
                            }
                          }}
                          onChange={(event) =>
                            updateScore(match.id, "homeGoals", event.target.value)
                          }
                          pattern="[0-9]*"
                          type="text"
                          value={value.homeGoals}
                        />
                        <span className="prediction-separator">x</span>
                        <input
                          aria-label={`Gols de ${match.away.name}`}
                          disabled={!editable}
                          inputMode="numeric"
                          min="0"
                          name={`away-${match.id}`}
                          onBlur={() => {
                            if (editable && value.homeGoals !== "" && value.awayGoals !== "") {
                              void submitDraft();
                            }
                          }}
                          onChange={(event) =>
                            updateScore(match.id, "awayGoals", event.target.value)
                          }
                          pattern="[0-9]*"
                          type="text"
                          value={value.awayGoals}
                        />
                        <span className="schedule-team away">
                          <span aria-hidden="true">{match.away.flag}</span>
                          <strong>{match.away.name}</strong>
                        </span>
                      </div>
                      <div className="match-meta-line lower">
                        <span>{match.venueLabel}</span>
                        {isConfirmed ? <span>Palpite bloqueado</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))
        )}
      </section>

      <section className="prediction-actions prediction-actions-bottom" aria-label="Ações de palpite">
        {actionButtons}
      </section>

      {confirmOpen ? (
        <div className="lightbox-backdrop" role="presentation">
          <div aria-labelledby="confirm-title" aria-modal="true" className="lightbox" role="dialog">
            <h2 id="confirm-title">Confirmar palpites?</h2>
            <p>
              Depois de confirmar, seus placares desta fase ficam travados e não poderão
              ser alterados.
            </p>
            <label className="confirm-check">
              <input
                checked={checked}
                onChange={(event) => setChecked(event.target.checked)}
                type="checkbox"
              />
              <span>Entendi que não poderei mudar estes palpites.</span>
            </label>
            <div className="prediction-actions">
              <button
                className="button"
                disabled={isPending}
                onClick={() => setConfirmOpen(false)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="button primary"
                disabled={!checked || isPending}
                onClick={confirmPredictions}
                type="button"
              >
                Confirmar e travar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
