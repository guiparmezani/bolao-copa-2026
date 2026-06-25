"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { TeamFlag } from "@/components/team-flag";

type PlacementKind = "champion" | "runner_up" | "third_place";

type TeamOption = {
  flagEmoji: string;
  id: string;
  iso2Code: string | null;
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

const completePlacementMessage = "Escolha uma seleção para cada colocação destacada.";

class PlacementValidationError extends Error {
  invalidPlacements: PlacementKind[];

  constructor(message: string, invalidPlacements: PlacementKind[]) {
    super(message);
    this.name = "PlacementValidationError";
    this.invalidPlacements = invalidPlacements;
    Object.setPrototypeOf(this, PlacementValidationError.prototype);
  }
}

function toPayload(values: Record<PlacementKind, string>, requireComplete: boolean) {
  const invalidPlacements: PlacementKind[] = [];
  const placements = [];

  for (const [placement, teamId] of Object.entries(values) as Array<[PlacementKind, string]>) {
    if (!requireComplete && !teamId) {
      continue;
    }

    if (!teamId) {
      invalidPlacements.push(placement);
      continue;
    }

    placements.push({ placement, teamId });
  }

  if (invalidPlacements.length > 0) {
    throw new PlacementValidationError(completePlacementMessage, invalidPlacements);
  }

  return placements;
}

function getPlacementValidationError(error: unknown) {
  if (error instanceof PlacementValidationError) {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "invalidPlacements" in error &&
    Array.isArray((error as { invalidPlacements: unknown }).invalidPlacements)
  ) {
    return error as PlacementValidationError;
  }

  return null;
}

function getInvalidPlacements(values: Record<PlacementKind, string>, requireComplete: boolean) {
  return (Object.entries(values) as Array<[PlacementKind, string]>)
    .filter(([, teamId]) => requireComplete || teamId)
    .filter(([, teamId]) => !teamId)
    .map(([placement]) => placement);
}

function TeamPicker({
  disabled,
  label,
  onChange,
  teams,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (teamId: string) => void;
  teams: TeamOption[];
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selectedTeam = teams.find((team) => team.id === value) ?? null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function selectTeam(teamId: string) {
    onChange(teamId);
    setIsOpen(false);
  }

  return (
    <div className="team-picker" ref={pickerRef}>
      <input name={label} type="hidden" value={value} />
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={label}
        aria-controls={isOpen ? listboxId : undefined}
        className="team-picker-button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        type="button"
      >
        {selectedTeam ? (
          <span className="team-picker-value">
            <TeamFlag team={selectedTeam} />
            <span>{selectedTeam.namePt}</span>
          </span>
        ) : (
          <span className="team-picker-placeholder">Selecione</span>
        )}
        <span aria-hidden="true" className="team-picker-caret">
          ▾
        </span>
      </button>
      {isOpen ? (
        <div className="team-picker-menu" id={listboxId} role="listbox">
          <button
            aria-selected={!value}
            className="team-picker-option"
            onClick={() => selectTeam("")}
            role="option"
            type="button"
          >
            Selecione
          </button>
          {teams.map((team) => (
            <button
              aria-selected={team.id === value}
              className="team-picker-option"
              key={team.id}
              onClick={() => selectTeam(team.id)}
              role="option"
              type="button"
            >
              <TeamFlag team={team} />
              <span>{team.namePt}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
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
  const [invalidPlacements, setInvalidPlacements] = useState<PlacementKind[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [isPending, startTransition] = useTransition();
  const messageRef = useRef<HTMLDivElement>(null);
  const editable = isOpen && !isConfirmed;

  function scrollToMessage() {
    window.setTimeout(() => {
      messageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  async function submitDraft(nextValues = values, scrollOnComplete = true) {
    setError(null);
    setInvalidPlacements([]);

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

      setInvalidPlacements([]);
      setStatus("Rascunho salvo.");
      if (scrollOnComplete) {
        scrollToMessage();
      }
    } catch (draftError) {
      const validationError = getPlacementValidationError(draftError);

      setStatus(null);
      setInvalidPlacements(
        validationError?.invalidPlacements ?? getInvalidPlacements(nextValues, false),
      );
      setError(draftError instanceof Error ? draftError.message : "Não foi possível salvar.");
      if (scrollOnComplete) {
        scrollToMessage();
      }
    }
  }

  function updatePlacement(placement: PlacementKind, teamId: string) {
    const nextValues = { ...values, [placement]: teamId };
    setValues(nextValues);
    setInvalidPlacements((current) => current.filter((key) => key !== placement));
    setStatus("Alterações ainda não salvas.");

    if (teamId) {
      void submitDraft(nextValues, false);
    }
  }

  function saveDraft() {
    startTransition(() => {
      void submitDraft();
    });
  }

  function openConfirmDialog() {
    setStatus(null);
    setError(null);

    const invalidKeys = getInvalidPlacements(values, true);

    if (invalidKeys.length > 0) {
      setInvalidPlacements(invalidKeys);
      setError(completePlacementMessage);
      scrollToMessage();
      return;
    }

    setInvalidPlacements([]);
    setConfirmOpen(true);
  }

  function confirmPredictions() {
    startTransition(async () => {
      setError(null);
      setInvalidPlacements([]);

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
        const validationError = getPlacementValidationError(confirmError);

        setConfirmOpen(false);
        setInvalidPlacements(
          validationError?.invalidPlacements ?? getInvalidPlacements(values, true),
        );
        setError(
          confirmError instanceof Error
            ? confirmError.message
            : "Não foi possível confirmar seus palpites.",
        );
        scrollToMessage();
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
        onClick={openConfirmDialog}
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
          <h1>Campeão, vice e terceiro</h1>
          <p>
            Escolha as colocações finais. O rascunho pode ser alterado até a
            confirmação ou até o prazo: {deadlineLabel}.
          </p>
        </div>
        <div className="prediction-actions">{actionButtons}</div>
      </section>

      {status || error ? (
        <div
          className={error ? "form-error prediction-message" : "prediction-message"}
          ref={messageRef}
        >
          {error ?? status}
        </div>
      ) : null}

      <section className="card placement-card" aria-label="Palpites de colocações finais">
        {placements.map((placement) => {
          const hasPlacementError = invalidPlacements.includes(placement.key);

          return (
            <div
              className={
                hasPlacementError ? "placement-row field-row-error" : "placement-row"
              }
              key={placement.key}
            >
              <span>{placement.label}</span>
              <TeamPicker
                disabled={!editable}
                label={placement.label}
                onChange={(teamId) => updatePlacement(placement.key, teamId)}
                teams={teams}
                value={values[placement.key]}
              />
              {hasPlacementError ? (
                <small className="field-error-text">Escolha uma seleção.</small>
              ) : null}
            </div>
          );
        })}
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
