export const ENGLAND_FLAG_EMOJI =
  "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
export const SCOTLAND_FLAG_EMOJI =
  "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";

export type TeamFlagSource = {
  flagEmoji?: string | null;
  iso2Code?: string | null;
  nameEn?: string | null;
  namePt?: string | null;
  providerId?: string | null;
};

export type TeamFlagVariant = "england" | "scotland";

function normalizeIdentity(value: string | null | undefined) {
  return value
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function getTeamFlagVariant(
  team: TeamFlagSource | null | undefined,
): TeamFlagVariant | null {
  if (!team) {
    return null;
  }

  const identities = [
    team.iso2Code,
    team.providerId,
    team.nameEn,
    team.namePt,
  ].map(normalizeIdentity);

  if (
    team.flagEmoji === ENGLAND_FLAG_EMOJI ||
    identities.some((identity) =>
      ["gb-eng", "england", "inglaterra"].includes(identity ?? ""),
    )
  ) {
    return "england";
  }

  if (
    team.flagEmoji === SCOTLAND_FLAG_EMOJI ||
    identities.some((identity) =>
      ["gb-sct", "scotland", "escocia"].includes(identity ?? ""),
    )
  ) {
    return "scotland";
  }

  return null;
}

export function getTeamTextFlag(team: TeamFlagSource | null | undefined) {
  if (!team || getTeamFlagVariant(team)) {
    return "";
  }

  return team.flagEmoji ?? "";
}

export function getTeamPlainLabel(
  team: ({ namePt: string } & TeamFlagSource) | null | undefined,
  flagPosition: "before" | "after" = "before",
) {
  if (!team) {
    return "A definir";
  }

  const flag = getTeamTextFlag(team);

  if (!flag) {
    return team.namePt;
  }

  return flagPosition === "after" ? `${team.namePt} ${flag}` : `${flag} ${team.namePt}`;
}
