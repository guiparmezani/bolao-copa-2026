"use client";

import { useState, useTransition } from "react";

type PlacementKind = "champion" | "runner_up" | "third_place";

type TeamOption = {
  flagEmoji: string;
  id: string;
  namePt: string;
};

type WinnersPredictionFormProps = {
  deadlineLabel: string;
  initialPlacements: Record<PlacementKind, string>;
  isConfirmed: boolean;
  isOpen: boolean;
  placements: Array<{ key: PlacementKind; label: string }>;
  teams: TeamOption[];
};

function toPayload(values: Record<PlacementKind, string>, requireComplete: boolean) {
  return Object.entries(values)
    .filter(([, teamId]) => requireComplete || teamId)
    .map(([placement, teamId]) => {
      if (!teamId) {
        throw new Error("Escolha uma seleção para cada colocação.");
      }

      return { placement, teamId };
    });
}

export function WinnersPredictionForm({
  deadlineLabel,
  initialPlacements,
  isConfirmed,
  isOpen,
  placements,
  teams,
}: WinnersPredictionFormProps) {
  const [values, setValues] = useState(initialPlacements);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [isPending, startTransition] = useTransition();
  const editable = isOpen && !isConfirmed;

  async function submitDraft(nextValues = values) {
    setError(null);

    try {
      const response = await fetch("/api/predictions/winners/draft", {
        body: JSON.stringify({ placements: toPayload(nextValues, false) }),
        headers: { "content-type": "application/json" },
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

  function updatePlacement(placement: PlacementKind, teamId: string) {
    const nextValues = { ...values, [placement]: teamId };
    setValues(nextValues);
    setStatus("Alterações ainda não salvas.");

    if (teamId) {
      void submitDraft(nextValues);
    }
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
        const response = await fetch("/api/predictions/winners/confirm", {
          body: JSON.stringify({ placements: toPayload(values, true) }),
          headers: { "content-type": "application/json" },
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
      <button className="button" disabled={!editable || isPending} onClick={saveDraft} type="button">
        Salvar rascunho
      </button>
      <button
        className="button primary"
        disabled={!editable || isPending || teams.length === 0}
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
          <h1>Campeão, vice e terceiro</h1>
          <p>
            Escolha as colocações finais. O rascunho pode ser alterado até a
            confirmação ou até o prazo: {deadlineLabel}.
          </p>
        </div>
        <div className="prediction-actions">{actionButtons}</div>
      </section>

      {status || error ? (
        <div className={error ? "form-error prediction-message" : "prediction-message"}>
          {error ?? status}
        </div>
      ) : null}

      <section className="card placement-card" aria-label="Palpites de colocações finais">
        {placements.map((placement) => (
          <label className="placement-row" key={placement.key}>
            <span>{placement.label}</span>
            <select
              disabled={!editable}
              onChange={(event) => updatePlacement(placement.key, event.target.value)}
              value={values[placement.key]}
            >
              <option value="">Selecione</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.flagEmoji} {team.namePt}
                </option>
              ))}
            </select>
          </label>
        ))}
      </section>

      <section className="prediction-actions prediction-actions-bottom" aria-label="Ações de palpite">
        {actionButtons}
      </section>

      {confirmOpen ? (
        <div className="lightbox-backdrop" role="presentation">
          <div aria-labelledby="confirm-title" aria-modal="true" className="lightbox" role="dialog">
            <h2 id="confirm-title">Confirmar campeões?</h2>
            <p>
              Depois de confirmar, seus palpites de campeão, vice e terceiro lugar ficam
              travados e não poderão ser alterados.
            </p>
            <label className="confirm-check">
              <input checked={checked} onChange={(event) => setChecked(event.target.checked)} type="checkbox" />
              <span>Entendi que não poderei mudar estes palpites.</span>
            </label>
            <div className="prediction-actions">
              <button className="button" disabled={isPending} onClick={() => setConfirmOpen(false)} type="button">
                Cancelar
              </button>
              <button className="button primary" disabled={!checked || isPending} onClick={confirmPredictions} type="button">
                Confirmar e travar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
