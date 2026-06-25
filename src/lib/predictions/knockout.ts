import "server-only";

import { Prisma, type Match, type MatchPrediction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  areRoundOf32FixturesResolved,
  getDefaultKnockoutSubmissionDeadline,
  getPreviousBrazilNightDeadline,
  isBeforeOrAtDeadline,
  isJsonEnabled,
  parseSettingDate,
} from "@/lib/predictions/deadlines";
import {
  type PredictionInput,
  PredictionRuleError,
  parsePredictionPayload,
} from "@/lib/predictions/group";

export const knockoutPhases = [
  "round_of_32",
  "round_of_16",
  "quarter_final",
  "semi_final",
  "third_place",
  "final",
] as const;

export type KnockoutPhase = (typeof knockoutPhases)[number];

export const knockoutPhaseDeadlineSettingKeys: Record<KnockoutPhase, string> = {
  round_of_32: "knockout_submission_deadline",
  round_of_16: "knockout_round_of_16_submission_deadline",
  quarter_final: "knockout_quarter_final_submission_deadline",
  semi_final: "knockout_semi_final_submission_deadline",
  third_place: "knockout_third_place_submission_deadline",
  final: "knockout_final_submission_deadline",
};

export type KnockoutPredictionMatch = Match & {
  homeTeam: { flagEmoji: string; iso2Code: string | null; namePt: string } | null;
  awayTeam: { flagEmoji: string; iso2Code: string | null; namePt: string } | null;
};

export type KnockoutPhaseDeadlines = Record<KnockoutPhase, Date>;

export function isPredictableKnockoutMatch(
  match: Pick<Match, "awayPlaceholder" | "awayTeamId" | "homePlaceholder" | "homeTeamId">,
) {
  return Boolean(
    match.homeTeamId &&
      match.awayTeamId &&
      !match.homePlaceholder &&
      !match.awayPlaceholder,
  );
}

export async function getKnockoutPredictionDeadline() {
  const deadlines = await getKnockoutPhaseDeadlines();

  return deadlines.round_of_32;
}

function defaultPhaseDeadline(phase: KnockoutPhase, kickoffAt: Date | null | undefined) {
  if (kickoffAt) {
    return getPreviousBrazilNightDeadline(kickoffAt) ?? getDefaultKnockoutSubmissionDeadline();
  }

  return phase === "round_of_32"
    ? getDefaultKnockoutSubmissionDeadline()
    : getDefaultKnockoutSubmissionDeadline();
}

export async function getKnockoutPhaseDeadlines() {
  const [settings, firstMatches] = await Promise.all([
    prisma.appSetting.findMany({
      where: {
        key: {
          in: Object.values(knockoutPhaseDeadlineSettingKeys),
        },
      },
    }),
    prisma.match.findMany({
      where: {
        phase: { in: [...knockoutPhases] },
        publicationStatus: "published",
      },
      orderBy: [{ kickoffAt: "asc" }, { matchNumber: "asc" }],
      select: {
        kickoffAt: true,
        phase: true,
      },
    }),
  ]);
  const settingByKey = new Map(settings.map((setting) => [setting.key, setting.value]));
  const firstKickoffByPhase = new Map<KnockoutPhase, Date>();

  for (const match of firstMatches) {
    if (!firstKickoffByPhase.has(match.phase as KnockoutPhase)) {
      firstKickoffByPhase.set(match.phase as KnockoutPhase, match.kickoffAt);
    }
  }

  return Object.fromEntries(
    knockoutPhases.map((phase) => {
      const settingDeadline = parseSettingDate(settingByKey.get(knockoutPhaseDeadlineSettingKeys[phase]));

      return [phase, settingDeadline ?? defaultPhaseDeadline(phase, firstKickoffByPhase.get(phase))];
    }),
  ) as KnockoutPhaseDeadlines;
}

export async function getPublishedKnockoutMatches() {
  return prisma.match.findMany({
    where: {
      phase: { in: [...knockoutPhases] },
      publicationStatus: "published",
    },
    include: {
      awayTeam: { select: { flagEmoji: true, iso2Code: true, namePt: true } },
      homeTeam: { select: { flagEmoji: true, iso2Code: true, namePt: true } },
    },
    orderBy: [{ kickoffAt: "asc" }, { matchNumber: "asc" }],
  });
}

function isKnockoutPhaseDeadlineOpen(
  phase: KnockoutPhase,
  deadlines: KnockoutPhaseDeadlines,
  now: Date,
) {
  return isBeforeOrAtDeadline(now, deadlines[phase]);
}

async function getKnockoutWindow(matches: KnockoutPredictionMatch[], deadlines: KnockoutPhaseDeadlines) {
  const [enabledSetting, roundOf32Matches] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: "knockout_predictions_enabled" } }),
    prisma.match.findMany({
      where: { phase: "round_of_32", publicationStatus: "published" },
      select: {
        awayPlaceholder: true,
        awayTeamId: true,
        homePlaceholder: true,
        homeTeamId: true,
      },
    }),
  ]);
  const now = new Date();
  const roundOf32Resolved = areRoundOf32FixturesResolved(roundOf32Matches);
  const enabled = enabledSetting ? isJsonEnabled(enabledSetting.value) : true;
  const predictableMatches = matches.filter(isPredictableKnockoutMatch);
  const openDeadlines = predictableMatches
    .map((match) => deadlines[match.phase as KnockoutPhase])
    .filter((deadline) => isBeforeOrAtDeadline(now, deadline))
    .sort((a, b) => a.getTime() - b.getTime());
  const fullyReady = enabled && roundOf32Resolved;
  const partiallyReady = enabled && predictableMatches.length > 0;
  const isOpen = partiallyReady && openDeadlines.length > 0;

  return {
    deadline: openDeadlines[0] ?? deadlines.round_of_32,
    deadlines,
    enabled,
    isFullyReady: fullyReady,
    isOpen,
    isReady: partiallyReady,
    nextDeadline: openDeadlines[0] ?? null,
    predictableMatchCount: predictableMatches.length,
    roundOf32Resolved,
    statusLabel: !partiallyReady ? "Bloqueado" : isOpen ? "Aberto parcial" : "Encerrado",
  };
}

export async function getKnockoutPredictionState(userId: string) {
  const [deadlines, matches, submission] = await Promise.all([
    getKnockoutPhaseDeadlines(),
    getPublishedKnockoutMatches(),
    prisma.predictionSubmission.findUnique({
      where: { userId_phaseGroup: { userId, phaseGroup: "knockout" } },
      include: { matchPredictions: true },
    }),
  ]);
  const window = await getKnockoutWindow(matches, deadlines);
  const predictionByMatchId = new Map(
    (submission?.matchPredictions ?? []).map((prediction) => [
      prediction.matchId,
      prediction,
    ]),
  );
  const predictableMatches = matches.filter(isPredictableKnockoutMatch);
  const predictedCount = predictableMatches.filter((match) => predictionByMatchId.has(match.id)).length;
  const confirmedCount = predictableMatches.filter(
    (match) => predictionByMatchId.get(match.id)?.confirmedAt,
  ).length;

  return {
    confirmedCount,
    deadline: window.deadline,
    deadlines,
    isConfirmed: predictableMatches.length > 0 && confirmedCount === predictableMatches.length,
    isComplete: predictableMatches.length > 0 && predictedCount === predictableMatches.length,
    matches: predictableMatches,
    predictedCount,
    predictionByMatchId,
    submission,
    window,
  };
}

function assertEditable({
  window,
}: {
  window: { isOpen: boolean; isReady: boolean };
}) {
  if (!window.isReady) {
    throw new PredictionRuleError(
      "Ainda não há jogos do mata-mata liberados para palpite.",
      403,
    );
  }

  if (!window.isOpen) {
    throw new PredictionRuleError("Não há jogos do mata-mata com prazo aberto para palpite.", 403);
  }
}

function assertPublishedKnockoutPredictionInputs(
  predictions: PredictionInput[],
  matches: Pick<Match, "id">[],
  requireComplete: boolean,
) {
  const matchIds = new Set(matches.map((match) => match.id));
  const seen = new Set<string>();

  for (const prediction of predictions) {
    if (!matchIds.has(prediction.matchId)) {
      throw new PredictionRuleError("Só é possível palpitar em jogos publicados do mata-mata.");
    }

    if (seen.has(prediction.matchId)) {
      throw new PredictionRuleError("Há jogos repetidos na lista de palpites.");
    }

    seen.add(prediction.matchId);
  }

  if (requireComplete && seen.size !== matchIds.size) {
    throw new PredictionRuleError(
      "Preencha todos os jogos publicados do mata-mata antes de confirmar.",
    );
  }
}

async function getEditableKnockoutContext(userId: string) {
  const [deadlines, matches, existingSubmission] = await Promise.all([
    getKnockoutPhaseDeadlines(),
    prisma.match.findMany({
      where: {
        awayPlaceholder: null,
        awayTeamId: { not: null },
        homePlaceholder: null,
        homeTeamId: { not: null },
        phase: { in: [...knockoutPhases] },
        publicationStatus: "published",
      },
      include: {
        awayTeam: { select: { flagEmoji: true, iso2Code: true, namePt: true } },
        homeTeam: { select: { flagEmoji: true, iso2Code: true, namePt: true } },
      },
    }),
    prisma.predictionSubmission.findUnique({
      where: { userId_phaseGroup: { userId, phaseGroup: "knockout" } },
      include: { matchPredictions: true },
    }),
  ]);
  const window = await getKnockoutWindow(matches, deadlines);
  const now = new Date();

  assertEditable({
    window,
  });

  const confirmedMatchIds = new Set(
    (existingSubmission?.matchPredictions ?? [])
      .filter((prediction) => prediction.confirmedAt)
      .map((prediction) => prediction.matchId),
  );
  const editableMatches = matches.filter((match) => {
    return (
      !confirmedMatchIds.has(match.id) &&
      isKnockoutPhaseDeadlineOpen(match.phase as KnockoutPhase, deadlines, now)
    );
  });

  return { matches: editableMatches };
}

export async function saveKnockoutPredictionDraft(
  userId: string,
  predictions: PredictionInput[],
) {
  const { matches } = await getEditableKnockoutContext(userId);
  assertPublishedKnockoutPredictionInputs(predictions, matches, false);

  return prisma.$transaction(async (tx) => {
    const submission = await tx.predictionSubmission.upsert({
      where: { userId_phaseGroup: { userId, phaseGroup: "knockout" } },
      update: {},
      create: { userId, phaseGroup: "knockout" },
    });

    for (const prediction of predictions) {
      await tx.matchPrediction.upsert({
        where: { userId_matchId: { userId, matchId: prediction.matchId } },
        update: {
          awayGoals: prediction.awayGoals,
          homeGoals: prediction.homeGoals,
          submissionId: submission.id,
        },
        create: {
          awayGoals: prediction.awayGoals,
          homeGoals: prediction.homeGoals,
          matchId: prediction.matchId,
          submissionId: submission.id,
          userId,
        },
      });
    }

    return submission;
  });
}

export async function confirmKnockoutPredictions(
  userId: string,
  predictions: PredictionInput[],
) {
  const { matches } = await getEditableKnockoutContext(userId);
  const now = new Date();
  assertPublishedKnockoutPredictionInputs(predictions, matches, true);

  return prisma.$transaction(async (tx) => {
    const submission = await tx.predictionSubmission.upsert({
      where: { userId_phaseGroup: { userId, phaseGroup: "knockout" } },
      update: {},
      create: { userId, phaseGroup: "knockout" },
    });

    for (const prediction of predictions) {
      await tx.matchPrediction.upsert({
        where: { userId_matchId: { userId, matchId: prediction.matchId } },
        update: {
          awayGoals: prediction.awayGoals,
          homeGoals: prediction.homeGoals,
          submissionId: submission.id,
        },
        create: {
          awayGoals: prediction.awayGoals,
          homeGoals: prediction.homeGoals,
          matchId: prediction.matchId,
          submissionId: submission.id,
          userId,
        },
      });
    }

    await tx.matchPrediction.updateMany({
      where: {
        matchId: { in: predictions.map((prediction) => prediction.matchId) },
        submissionId: submission.id,
        userId,
      },
      data: { confirmedAt: now },
    });

    const allPredictableMatches = await tx.match.findMany({
      where: {
        awayPlaceholder: null,
        awayTeamId: { not: null },
        homePlaceholder: null,
        homeTeamId: { not: null },
        phase: { in: [...knockoutPhases] },
        publicationStatus: "published",
      },
      select: { id: true },
    });
    const confirmedPredictions = await tx.matchPrediction.count({
      where: {
        confirmedAt: { not: null },
        matchId: { in: allPredictableMatches.map((match) => match.id) },
        submissionId: submission.id,
        userId,
      },
    });

    if (
      allPredictableMatches.length > 0 &&
      confirmedPredictions === allPredictableMatches.length
    ) {
      return tx.predictionSubmission.update({
        where: { id: submission.id },
        data: { confirmedAt: now, status: "confirmed" },
      });
    }

    return submission;
  });
}

export function serializeKnockoutPrediction(prediction: MatchPrediction) {
  return {
    awayGoals: prediction.awayGoals,
    confirmedAt: prediction.confirmedAt?.toISOString() ?? null,
    homeGoals: prediction.homeGoals,
    matchId: prediction.matchId,
  };
}

export { parsePredictionPayload };

export function knockoutPredictionErrorResponse(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2003")
  ) {
    return Response.json({ error: "Não foi possível salvar esses palpites." }, { status: 400 });
  }

  if (error instanceof PredictionRuleError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  throw error;
}
