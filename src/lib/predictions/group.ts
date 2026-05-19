import "server-only";

import { Prisma, type Match, type MatchPrediction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getDefaultGroupSubmissionDeadline,
  getGroupSubmissionWindow,
  parseSettingDate,
} from "@/lib/predictions/deadlines";

export type PredictionInput = {
  matchId: string;
  homeGoals: number;
  awayGoals: number;
};

export type GroupPredictionMatch = Match & {
  homeTeam: { flagEmoji: string; namePt: string } | null;
  awayTeam: { flagEmoji: string; namePt: string } | null;
};

export type GroupPredictionState = Awaited<ReturnType<typeof getGroupPredictionState>>;

export class PredictionRuleError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PredictionRuleError";
    this.status = status;
  }
}

export async function getGroupPredictionDeadline() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: "group_submission_deadline" },
  });

  return parseSettingDate(setting?.value) ?? getDefaultGroupSubmissionDeadline();
}

export async function getPublishedGroupMatches() {
  return prisma.match.findMany({
    where: {
      phase: "group",
      publicationStatus: "published",
    },
    include: {
      awayTeam: {
        select: {
          flagEmoji: true,
          namePt: true,
        },
      },
      homeTeam: {
        select: {
          flagEmoji: true,
          namePt: true,
        },
      },
    },
    orderBy: [{ kickoffAt: "asc" }, { matchNumber: "asc" }],
  });
}

export async function getGroupPredictionState(userId: string) {
  const [deadline, matches, submission] = await Promise.all([
    getGroupPredictionDeadline(),
    getPublishedGroupMatches(),
    prisma.predictionSubmission.findUnique({
      where: {
        userId_phaseGroup: {
          userId,
          phaseGroup: "group",
        },
      },
      include: {
        matchPredictions: true,
      },
    }),
  ]);
  const predictionByMatchId = new Map(
    (submission?.matchPredictions ?? []).map((prediction) => [
      prediction.matchId,
      prediction,
    ]),
  );
  const predictedCount = matches.filter((match) => predictionByMatchId.has(match.id)).length;
  const window = getGroupSubmissionWindow(new Date(), deadline);

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

export function parsePredictionPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("predictions" in payload)) {
    throw new PredictionRuleError("Envie os palpites no formato esperado.");
  }

  const predictions = (payload as { predictions: unknown }).predictions;

  if (!Array.isArray(predictions)) {
    throw new PredictionRuleError("A lista de palpites é inválida.");
  }

  return predictions.map((prediction) => {
    if (!prediction || typeof prediction !== "object") {
      throw new PredictionRuleError("Um dos palpites está inválido.");
    }

    const { matchId, homeGoals, awayGoals } = prediction as Record<string, unknown>;

    if (typeof matchId !== "string" || !matchId) {
      throw new PredictionRuleError("Um dos jogos não foi identificado.");
    }

    if (
      typeof homeGoals !== "number" ||
      typeof awayGoals !== "number" ||
      !Number.isInteger(homeGoals) ||
      !Number.isInteger(awayGoals) ||
      homeGoals < 0 ||
      awayGoals < 0 ||
      homeGoals > 99 ||
      awayGoals > 99
    ) {
      throw new PredictionRuleError("Use placares inteiros entre 0 e 99.");
    }

    return {
      awayGoals,
      homeGoals,
      matchId,
    };
  });
}

function assertEditable({
  deadline,
  now,
  submissionStatus,
}: {
  deadline: Date;
  now: Date;
  submissionStatus?: string;
}) {
  if (submissionStatus === "confirmed") {
    throw new PredictionRuleError("Seus palpites da fase de grupos já foram confirmados.", 409);
  }

  if (now.getTime() > deadline.getTime()) {
    throw new PredictionRuleError(
      "O prazo para palpites da fase de grupos já foi encerrado.",
      403,
    );
  }
}

function assertPublishedGroupPredictionInputs(
  predictions: PredictionInput[],
  matches: Pick<Match, "id">[],
  requireComplete: boolean,
) {
  const matchIds = new Set(matches.map((match) => match.id));
  const seen = new Set<string>();

  for (const prediction of predictions) {
    if (!matchIds.has(prediction.matchId)) {
      throw new PredictionRuleError(
        "Só é possível palpitar em jogos publicados da fase de grupos.",
      );
    }

    if (seen.has(prediction.matchId)) {
      throw new PredictionRuleError("Há jogos repetidos na lista de palpites.");
    }

    seen.add(prediction.matchId);
  }

  if (requireComplete && seen.size !== matchIds.size) {
    throw new PredictionRuleError(
      "Preencha todos os jogos publicados da fase de grupos antes de confirmar.",
    );
  }
}

export async function saveGroupPredictionDraft(userId: string, predictions: PredictionInput[]) {
  const [deadline, matches, existingSubmission] = await Promise.all([
    getGroupPredictionDeadline(),
    prisma.match.findMany({
      where: {
        phase: "group",
        publicationStatus: "published",
      },
      select: { id: true },
    }),
    prisma.predictionSubmission.findUnique({
      where: {
        userId_phaseGroup: {
          userId,
          phaseGroup: "group",
        },
      },
    }),
  ]);

  assertEditable({
    deadline,
    now: new Date(),
    submissionStatus: existingSubmission?.status,
  });
  assertPublishedGroupPredictionInputs(predictions, matches, false);

  return prisma.$transaction(async (tx) => {
    const submission = await tx.predictionSubmission.upsert({
      where: {
        userId_phaseGroup: {
          userId,
          phaseGroup: "group",
        },
      },
      update: {},
      create: {
        userId,
        phaseGroup: "group",
      },
    });

    for (const prediction of predictions) {
      await tx.matchPrediction.upsert({
        where: {
          userId_matchId: {
            userId,
            matchId: prediction.matchId,
          },
        },
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

export async function confirmGroupPredictions(userId: string, predictions: PredictionInput[]) {
  const [deadline, matches, existingSubmission] = await Promise.all([
    getGroupPredictionDeadline(),
    prisma.match.findMany({
      where: {
        phase: "group",
        publicationStatus: "published",
      },
      select: { id: true },
    }),
    prisma.predictionSubmission.findUnique({
      where: {
        userId_phaseGroup: {
          userId,
          phaseGroup: "group",
        },
      },
    }),
  ]);
  const now = new Date();

  assertEditable({
    deadline,
    now,
    submissionStatus: existingSubmission?.status,
  });
  assertPublishedGroupPredictionInputs(predictions, matches, true);

  return prisma.$transaction(async (tx) => {
    const submission = await tx.predictionSubmission.upsert({
      where: {
        userId_phaseGroup: {
          userId,
          phaseGroup: "group",
        },
      },
      update: {},
      create: {
        userId,
        phaseGroup: "group",
      },
    });

    for (const prediction of predictions) {
      await tx.matchPrediction.upsert({
        where: {
          userId_matchId: {
            userId,
            matchId: prediction.matchId,
          },
        },
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
        submissionId: submission.id,
        userId,
      },
      data: {
        confirmedAt: now,
      },
    });

    return tx.predictionSubmission.update({
      where: { id: submission.id },
      data: {
        confirmedAt: now,
        status: "confirmed",
      },
    });
  });
}

export function serializePrediction(prediction: MatchPrediction) {
  return {
    awayGoals: prediction.awayGoals,
    confirmedAt: prediction.confirmedAt?.toISOString() ?? null,
    homeGoals: prediction.homeGoals,
    matchId: prediction.matchId,
  };
}

export function predictionErrorResponse(error: unknown) {
  if (error instanceof PredictionRuleError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2003")
  ) {
    return Response.json({ error: "Não foi possível salvar esses palpites." }, { status: 400 });
  }

  throw error;
}
