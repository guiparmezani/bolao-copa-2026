import {
  getTeamFlagImageSrc,
  getTeamFlagImageSrcSet,
  getTeamFlagVariant,
  type TeamFlagSource,
} from "@/lib/team-flags";

type TeamFlagProps = {
  className?: string;
  fallback?: string | null;
  flag?: string | null;
  team?: TeamFlagSource | null;
};

type TeamLabelProps = {
  flagPosition?: "before" | "after";
  placeholder?: string | null;
  team?: ({ namePt: string } & TeamFlagSource) | null;
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function EnglandFlagSvg() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 60 36">
      <rect fill="#fff" height="36" width="60" />
      <path d="M0 14h60v8H0zM26 0h8v36h-8z" fill="#c8102e" />
    </svg>
  );
}

function ScotlandFlagSvg() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 60 36">
      <rect fill="#0065bd" height="36" width="60" />
      <path d="M0 0 60 36M60 0 0 36" stroke="#fff" strokeWidth="7" />
    </svg>
  );
}

export function TeamFlag({ className, fallback = "", flag, team }: TeamFlagProps) {
  const source = team ?? (flag ? { flagEmoji: flag } : null);
  const variant = getTeamFlagVariant(source);

  if (variant) {
    return (
      <span
        aria-hidden="true"
        className={classNames("team-flag-icon", `team-flag-icon--${variant}`, className)}
      >
        {variant === "england" ? <EnglandFlagSvg /> : <ScotlandFlagSvg />}
      </span>
    );
  }

  const flagImageSrc = getTeamFlagImageSrc(source);

  if (flagImageSrc) {
    return (
      <span aria-hidden="true" className={classNames("team-flag-icon", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          decoding="async"
          loading="lazy"
          src={flagImageSrc}
          srcSet={getTeamFlagImageSrcSet(source) ?? undefined}
        />
      </span>
    );
  }

  const textFlag = team?.flagEmoji ?? flag ?? fallback;

  if (!textFlag) {
    return null;
  }

  return (
    <span aria-hidden="true" className={className}>
      {textFlag}
    </span>
  );
}

export function TeamLabel({
  flagPosition = "before",
  placeholder,
  team,
}: TeamLabelProps) {
  if (!team) {
    return <>{placeholder ?? "A definir"}</>;
  }

  if (flagPosition === "after") {
    return (
      <>
        {team.namePt} <TeamFlag team={team} />
      </>
    );
  }

  return (
    <>
      <TeamFlag team={team} /> {team.namePt}
    </>
  );
}
