import "server-only";

import { Prisma, type Match, type MatchPrediction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  areRoundOf32FixturesResolved,
  getDefaultKnockoutSubmissionDeadline,
  getKnockoutSubmissionWindow,
  isJsonEnabled,
  parseSettingDate,
} from "@/lib/predictions/deadlines";
import {
  type PredictionInput,
  PredictionRuleError,
  parsePredictionPayload,
} from "@/lib/predictions/group";

const knockoutPhases = [
  "round_of_32",
  "round_of_16",
  "quarter_final",
  "semi_final",
  "third_place",
  "final",
] as const;

export type KnockoutPredictionMatch = Match & {
  homeTeam: { flagEmoji: string; namePt: string } | null;
  awayTeam: { flagEmoji: string; namePt: string } | null;
};

export async function getKnockoutPredictionDeadline() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: "knockout_submission_deadline" },
  });

  return parseSettingDate(setting?.value) ?? getDefaultKnockoutSubmissionDeadline();
}

export async function getPublishedKnockoutMatches() {
  return prisma.match.findMany({
    where: {
      phase: { in: [...knockoutPhases] },
      publicationStatus: "published",
    },
    include: {
      awayTeam: { select: { flagEmoji: true, namePt: true } },
      homeTeam: { select: { flagEmoji: true, namePt: true } },
    },
    orderBy: [{ kickoffAt: "asc" }, { matchNumber: "asc" }],
  });
}

async function getKnockoutWindow(deadline: Date) {
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

  return getKnockoutSubmissionWindow({
    deadline,
    enabledBySetting: isJsonEnabled(enabledSetting?.value),
    now: new Date(),
    roundOf32Resolved: areRoundOf32FixturesResolved(roundOf32Matches),
  });
}

export async function getKnockoutPredictionState(userId: string) {
  const deadline = await getKnockoutPredictionDeadline();
  const [matches, submission, window] = await Promise.all([
    getPublishedKnockoutMatches(),
    prisma.predictionSubmission.findUnique({
      where: { userId_phaseGroup: { userId, phaseGroup: "knockout" } },
      include: { matchPredictions: true },
    }),
    getKnockoutWindow(deadline),
  ]);
  const predictionByMatchId = new Map(
    (submission?.matchPredictions ?? []).map((prediction) => [
      prediction.matchId,
      prediction,
    ]),
  );
  const predictedCount = matches.filter((match) => predictionByMatchId.has(match.id)).length;

  return {
    deadline,
    isConfirmed: submission?.status === "confirmed",
    isComplete: matches.length > 0 && predictedCount === matches.length,
    matches,
    predictedCount,
    predictionByMatchId,
    submission,
    window,
  };
}

function assertEditable({
  now,
  submissionStatus,
  window,
}: {
  now: Date;
  submissionStatus?: string;
  window: { deadline: Date; isOpen: boolean; isReady: boolean };
}) {
  if (submissionStatus === "confirmed") {
    throw new PredictionRuleError("Seus palpites do mata-mata já foram confirmados.", 409);
  }

  if (!window.isReady) {
    throw new PredictionRuleError(
      "Os palpites do mata-mata ainda não foram liberados.",
      403,
    );
  }

  if (!window.isOpen || now.getTime() > window.deadline.getTime()) {
    throw new PredictionRuleError("O prazo para palpites do mata-mata já foi encerrado.", 403);
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
  const deadline = await getKnockoutPredictionDeadline();
  const [matches, existingSubmission, window] = await Promise.all([
    prisma.match.findMany({
      where: {
        phase: { in: [...knockoutPhases] },
        publicationStatus: "published",
      },
      select: { id: true },
    }),
    prisma.predictionSubmission.findUnique({
      where: { userId_phaseGroup: { userId, phaseGroup: "knockout" } },
    }),
    getKnockoutWindow(deadline),
  ]);

  assertEditable({
    now: new Date(),
    submissionStatus: existingSubmission?.status,
    window,
  });

  return { matches };
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
      where: { submissionId: submission.id, userId },
      data: { confirmedAt: now },
    });

    return tx.predictionSubmission.update({
      where: { id: submission.id },
      data: { confirmedAt: now, status: "confirmed" },
    });
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
