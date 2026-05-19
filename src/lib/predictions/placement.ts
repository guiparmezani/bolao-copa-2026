import "server-only";

import { Prisma, type PlacementPredictionKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getDefaultPlacementSubmissionDeadline,
  getPlacementSubmissionWindow,
  isJsonEnabled,
  parseSettingDate,
} from "@/lib/predictions/deadlines";
import { PredictionRuleError } from "@/lib/predictions/group";

export type PlacementInput = {
  placement: PlacementPredictionKind;
  teamId: string;
};

export const placementLabels: Record<PlacementPredictionKind, string> = {
  champion: "Campeão",
  runner_up: "Vice-campeão",
  third_place: "Terceiro lugar",
};

const placementKinds: PlacementPredictionKind[] = ["champion", "runner_up", "third_place"];

export async function getPlacementPredictionDeadline() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: "placement_submission_deadline" },
  });

  return parseSettingDate(setting?.value) ?? getDefaultPlacementSubmissionDeadline();
}

async function getPlacementEnabled() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: "placement_predictions_enabled" },
  });

  return setting ? isJsonEnabled(setting.value) : true;
}

export async function getPlacementPredictionState(userId: string) {
  const deadline = await getPlacementPredictionDeadline();
  const [enabled, teams, submission] = await Promise.all([
    getPlacementEnabled(),
    prisma.team.findMany({
      orderBy: [{ namePt: "asc" }],
      select: { flagEmoji: true, id: true, namePt: true },
    }),
    prisma.predictionSubmission.findUnique({
      where: { userId_phaseGroup: { userId, phaseGroup: "placement" } },
      include: { placementPredictions: true },
    }),
  ]);
  const predictionByPlacement = new Map(
    (submission?.placementPredictions ?? []).map((prediction) => [
      prediction.placement,
      prediction,
    ]),
  );
  const predictedCount = placementKinds.filter((placement) =>
    predictionByPlacement.has(placement),
  ).length;
  const window = getPlacementSubmissionWindow(new Date(), deadline, enabled);

  return {
    deadline,
    isConfirmed: submission?.status === "confirmed",
    isComplete: predictedCount === placementKinds.length,
    placementKinds,
    predictedCount,
    predictionByPlacement,
    submission,
    teams,
    window,
  };
}

export function parsePlacementPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("placements" in payload)) {
    throw new PredictionRuleError("Envie os palpites no formato esperado.");
  }

  const placements = (payload as { placements: unknown }).placements;

  if (!Array.isArray(placements)) {
    throw new PredictionRuleError("A lista de palpites é inválida.");
  }

  return placements.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new PredictionRuleError("Um dos palpites está inválido.");
    }

    const { placement, teamId } = entry as Record<string, unknown>;

    if (!placementKinds.includes(placement as PlacementPredictionKind)) {
      throw new PredictionRuleError("Uma das colocações está inválida.");
    }

    if (typeof teamId !== "string" || !teamId) {
      throw new PredictionRuleError("Escolha uma seleção para cada colocação.");
    }

    return { placement: placement as PlacementPredictionKind, teamId };
  });
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
    throw new PredictionRuleError("Seus palpites de campeões já foram confirmados.", 409);
  }

  if (!window.isReady) {
    throw new PredictionRuleError("Os palpites de campeões estão desativados.", 403);
  }

  if (!window.isOpen || now.getTime() > window.deadline.getTime()) {
    throw new PredictionRuleError("O prazo para palpites de campeões já foi encerrado.", 403);
  }
}

async function getEditablePlacementContext(userId: string) {
  const deadline = await getPlacementPredictionDeadline();
  const [enabled, existingSubmission, teams] = await Promise.all([
    getPlacementEnabled(),
    prisma.predictionSubmission.findUnique({
      where: { userId_phaseGroup: { userId, phaseGroup: "placement" } },
    }),
    prisma.team.findMany({ select: { id: true } }),
  ]);
  const window = getPlacementSubmissionWindow(new Date(), deadline, enabled);

  assertEditable({
    now: new Date(),
    submissionStatus: existingSubmission?.status,
    window,
  });

  return { teams };
}

function assertPlacementInputs(
  placements: PlacementInput[],
  teams: Array<{ id: string }>,
  requireComplete: boolean,
) {
  const teamIds = new Set(teams.map((team) => team.id));
  const seenPlacements = new Set<PlacementPredictionKind>();
  const seenTeams = new Set<string>();

  for (const prediction of placements) {
    if (seenPlacements.has(prediction.placement)) {
      throw new PredictionRuleError("Há colocações repetidas na lista de palpites.");
    }

    if (!teamIds.has(prediction.teamId)) {
      throw new PredictionRuleError("Escolha apenas seleções cadastradas.");
    }

    if (seenTeams.has(prediction.teamId)) {
      throw new PredictionRuleError("Use seleções diferentes para campeão, vice e terceiro.");
    }

    seenPlacements.add(prediction.placement);
    seenTeams.add(prediction.teamId);
  }

  if (requireComplete && seenPlacements.size !== placementKinds.length) {
    throw new PredictionRuleError("Escolha campeão, vice-campeão e terceiro lugar antes de confirmar.");
  }
}

export async function savePlacementPredictionDraft(userId: string, placements: PlacementInput[]) {
  const { teams } = await getEditablePlacementContext(userId);
  assertPlacementInputs(placements, teams, false);

  return prisma.$transaction(async (tx) => {
    const submission = await tx.predictionSubmission.upsert({
      where: { userId_phaseGroup: { userId, phaseGroup: "placement" } },
      update: {},
      create: { userId, phaseGroup: "placement" },
    });

    for (const prediction of placements) {
      await tx.placementPrediction.upsert({
        where: { userId_placement: { userId, placement: prediction.placement } },
        update: { submissionId: submission.id, teamId: prediction.teamId },
        create: {
          placement: prediction.placement,
          submissionId: submission.id,
          teamId: prediction.teamId,
          userId,
        },
      });
    }

    return submission;
  });
}

export async function confirmPlacementPredictions(userId: string, placements: PlacementInput[]) {
  const { teams } = await getEditablePlacementContext(userId);
  const now = new Date();
  assertPlacementInputs(placements, teams, true);

  return prisma.$transaction(async (tx) => {
    const submission = await tx.predictionSubmission.upsert({
      where: { userId_phaseGroup: { userId, phaseGroup: "placement" } },
      update: {},
      create: { userId, phaseGroup: "placement" },
    });

    for (const prediction of placements) {
      await tx.placementPrediction.upsert({
        where: { userId_placement: { userId, placement: prediction.placement } },
        update: { submissionId: submission.id, teamId: prediction.teamId },
        create: {
          placement: prediction.placement,
          submissionId: submission.id,
          teamId: prediction.teamId,
          userId,
        },
      });
    }

    await tx.placementPrediction.updateMany({
      where: { submissionId: submission.id, userId },
      data: { confirmedAt: now },
    });

    return tx.predictionSubmission.update({
      where: { id: submission.id },
      data: { confirmedAt: now, status: "confirmed" },
    });
  });
}

export function serializePlacementPrediction(prediction: {
  confirmedAt: Date | null;
  placement: PlacementPredictionKind;
  teamId: string;
}) {
  return {
    confirmedAt: prediction.confirmedAt?.toISOString() ?? null,
    placement: prediction.placement,
    teamId: prediction.teamId,
  };
}

export function placementPredictionErrorResponse(error: unknown) {
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
