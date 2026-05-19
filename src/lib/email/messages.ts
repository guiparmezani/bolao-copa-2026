import "server-only";

import type { PredictionPhaseGroup } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { formatBrazilDate, formatBrazilTime, phaseLabels } from "@/lib/tournament";
import { placementLabels } from "@/lib/predictions/placement";
import { sendTransactionalEmail } from "./resend";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function teamLabel(team: { flagEmoji: string; namePt: string } | null, placeholder: string | null) {
  return team ? `${team.flagEmoji} ${team.namePt}` : placeholder ?? "A definir";
}

export async function sendAccountVerificationEmail({
  displayName,
  to,
  verificationUrl,
}: {
  displayName: string;
  to: string;
  verificationUrl: string;
}) {
  const subject = "Confirme sua conta no Bolão dos Facabundos";
  const text = [
    `Olá, ${displayName}.`,
    "",
    "Confirme sua conta no Bolão dos Facabundos Copa 2026 pelo link abaixo:",
    verificationUrl,
    "",
    "O link expira em 24 horas.",
  ].join("\n");
  const html = `
    <p>Olá, ${escapeHtml(displayName)}.</p>
    <p>Confirme sua conta no Bolão dos Facabundos Copa 2026 pelo link abaixo:</p>
    <p><a href="${escapeHtml(verificationUrl)}">Confirmar minha conta</a></p>
    <p>O link expira em 24 horas.</p>
  `;

  return sendTransactionalEmail({
    html,
    idempotencyKey: `verify-${to}`,
    subject,
    text,
    to,
  });
}

export async function sendPredictionSubmissionEmail(
  userId: string,
  phaseGroup: PredictionPhaseGroup,
  submissionId: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      displayName: true,
      email: true,
    },
  });

  if (!user?.email) {
    return { skipped: true as const };
  }

  const submission = await prisma.predictionSubmission.findUnique({
    where: { id: submissionId },
  });
  const titleByPhase: Record<PredictionPhaseGroup, string> = {
    group: "fase de grupos",
    knockout: "mata-mata",
    placement: "campeão, vice e terceiro",
  };
  let lines: string[] = [];

  if (phaseGroup === "placement") {
    const predictions = await prisma.placementPrediction.findMany({
      where: { submissionId },
      include: { team: true },
      orderBy: { placement: "asc" },
    });

    lines = predictions.map(
      (prediction) =>
        `${placementLabels[prediction.placement]}: ${prediction.team.flagEmoji} ${prediction.team.namePt}`,
    );
  } else {
    const predictions = await prisma.matchPrediction.findMany({
      where: { submissionId },
      include: {
        match: {
          include: {
            awayTeam: true,
            homeTeam: true,
          },
        },
      },
      orderBy: [{ match: { kickoffAt: "asc" } }, { match: { matchNumber: "asc" } }],
    });

    lines = predictions.map((prediction) => {
      const match = prediction.match;

      return [
        `Jogo ${match.matchNumber}`,
        phaseLabels[match.phase],
        `${formatBrazilDate(match.kickoffAt)} ${formatBrazilTime(match.kickoffAt)}`,
        `${teamLabel(match.homeTeam, match.homePlaceholder)} ${prediction.homeGoals} x ${prediction.awayGoals} ${teamLabel(match.awayTeam, match.awayPlaceholder)}`,
      ].join(" - ");
    });
  }

  const subject = `Seus palpites do Bolão: ${titleByPhase[phaseGroup]}`;
  const text = [
    `Olá, ${user.displayName}.`,
    "",
    `Recebemos seus palpites de ${titleByPhase[phaseGroup]}.`,
    submission?.confirmedAt
      ? `Confirmado em: ${submission.confirmedAt.toISOString()}`
      : null,
    "",
    ...lines,
  ]
    .filter(Boolean)
    .join("\n");
  const html = `
    <p>Olá, ${escapeHtml(user.displayName)}.</p>
    <p>Recebemos seus palpites de ${escapeHtml(titleByPhase[phaseGroup])}.</p>
    ${
      submission?.confirmedAt
        ? `<p>Confirmado em: ${escapeHtml(submission.confirmedAt.toISOString())}</p>`
        : ""
    }
    <ul>
      ${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
    </ul>
  `;

  return sendTransactionalEmail({
    html,
    idempotencyKey: `predictions-${submissionId}`,
    subject,
    text,
    to: user.email,
  });
}
