import Image from "next/image";
import Link from "next/link";

type AvatarUser = {
  avatarImageDataUrl?: string | null;
  displayName: string;
  id?: string;
  role?: string;
  status?: string;
  userId?: string;
};

type UserAvatarProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  user: AvatarUser;
};

type UserIdentityProps = {
  avatarSize?: UserAvatarProps["size"];
  className?: string;
  linkToPredictions?: boolean;
  suffix?: string;
  user: AvatarUser;
};

function getInitials(displayName: string) {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .map((part) => part.match(/[\p{L}\p{N}]/u)?.[0] ?? "")
    .filter(Boolean)
    .slice(0, 2);

  if (initials.length >= 2) {
    return initials.join("").toLocaleUpperCase("pt-BR");
  }

  const compactName = Array.from(displayName.matchAll(/[\p{L}\p{N}]/gu), (match) => match[0])
    .slice(0, 2)
    .join("");

  if (!compactName) {
    return "BF";
  }

  return compactName.toLocaleUpperCase("pt-BR");
}

function getAvatarPixels(size: NonNullable<UserAvatarProps["size"]>) {
  if (size === "lg") {
    return 92;
  }

  if (size === "md") {
    return 42;
  }

  return 30;
}

function getPredictionHref(user: AvatarUser) {
  const userId = user.id ?? user.userId;

  if (!userId || (user.role && user.role !== "player") || (user.status && user.status !== "active")) {
    return null;
  }

  return `/predictions?usuario=${encodeURIComponent(userId)}`;
}

export function UserAvatar({ className, size = "sm", user }: UserAvatarProps) {
  const classes = ["user-avatar", `user-avatar-${size}`, className].filter(Boolean).join(" ");

  if (user.avatarImageDataUrl) {
    const pixels = getAvatarPixels(size);

    return (
      <Image
        alt=""
        aria-hidden="true"
        className={classes}
        height={pixels}
        src={user.avatarImageDataUrl}
        unoptimized
        width={pixels}
      />
    );
  }

  return (
    <span aria-hidden="true" className={`${classes} user-avatar-fallback`}>
      {getInitials(user.displayName)}
    </span>
  );
}

export function UserIdentity({
  avatarSize = "sm",
  className,
  linkToPredictions = true,
  suffix = "",
  user,
}: UserIdentityProps) {
  const classes = ["user-identity", className].filter(Boolean).join(" ");
  const content = (
    <>
      <UserAvatar size={avatarSize} user={user} />
      <strong className="user-identity-name">
        {user.displayName}
        {suffix}
      </strong>
    </>
  );
  const href = linkToPredictions ? getPredictionHref(user) : null;

  if (href) {
    return (
      <Link className={`${classes} user-identity-link`} href={href}>
        {content}
      </Link>
    );
  }

  return (
    <span className={classes}>
      {content}
    </span>
  );
}
