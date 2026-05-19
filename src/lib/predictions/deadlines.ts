import type { Prisma } from "@prisma/client";

export const defaultGroupSubmissionDeadlineIso = "2026-06-12T02:59:00.000Z";
export const defaultKnockoutSubmissionDeadlineIso = "2026-06-28T02:59:00.000Z";
export const defaultPlacementSubmissionDeadlineIso = defaultGroupSubmissionDeadlineIso;
export const groupSubmissionTimeZone = "America/Sao_Paulo";

export function parseSettingDate(value: Prisma.JsonValue | null | undefined) {
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "iso" in value &&
    typeof value.iso === "string"
  ) {
    const date = new Date(value.iso);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

export function getDefaultGroupSubmissionDeadline() {
  return new Date(defaultGroupSubmissionDeadlineIso);
}

export function getDefaultKnockoutSubmissionDeadline() {
  return new Date(defaultKnockoutSubmissionDeadlineIso);
}

export function getDefaultPlacementSubmissionDeadline() {
  return new Date(defaultPlacementSubmissionDeadlineIso);
}

export function isBeforeOrAtDeadline(now: Date, deadline: Date) {
  return now.getTime() <= deadline.getTime();
}

export function isJsonEnabled(value: Prisma.JsonValue | null | undefined) {
  return value === true || value === "true";
}

export function areRoundOf32FixturesResolved(
  matches: Array<{
    awayPlaceholder: string | null;
    awayTeamId: string | null;
    homePlaceholder: string | null;
    homeTeamId: string | null;
  }>,
) {
  return (
    matches.length === 16 &&
    matches.every((match) =>
      Boolean(match.homeTeamId && match.awayTeamId && !match.homePlaceholder && !match.awayPlaceholder),
    )
  );
}

export function getKnockoutSubmissionWindow({
  deadline,
  enabledBySetting,
  now,
  roundOf32Resolved,
}: {
  deadline: Date;
  enabledBySetting: boolean;
  now: Date;
  roundOf32Resolved: boolean;
}) {
  const isReady = enabledBySetting && roundOf32Resolved;
  const isOpen = isReady && isBeforeOrAtDeadline(now, deadline);

  return {
    deadline,
    isOpen,
    isReady,
    statusLabel: !isReady ? "Bloqueado" : isOpen ? "Aberto" : "Encerrado",
  };
}

export function getGroupSubmissionWindow(now: Date, deadline: Date) {
  const isOpen = isBeforeOrAtDeadline(now, deadline);

  return {
    deadline,
    isOpen,
    statusLabel: isOpen ? "Aberto" : "Encerrado",
  };
}

export function getPlacementSubmissionWindow(now: Date, deadline: Date, enabled: boolean) {
  const isOpen = enabled && isBeforeOrAtDeadline(now, deadline);

  return {
    deadline,
    isOpen,
    isReady: enabled,
    statusLabel: !enabled ? "Bloqueado" : isOpen ? "Aberto" : "Encerrado",
  };
}
