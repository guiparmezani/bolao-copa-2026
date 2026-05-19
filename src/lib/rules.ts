import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  defaultScoringRules,
  type MatchPhase,
  type ScoringRuleConfig,
} from "@/lib/scoring";

type RulesClient = PrismaClient | typeof prisma;

export type PlacementBonuses = {
  champion: number;
  runner_up: number;
  third_place: number;
};

export const defaultPlacementBonuses: PlacementBonuses = {
  champion: 75,
  runner_up: 50,
  third_place: 25,
};

function decimalToNumber(value: Prisma.Decimal | number) {
  return typeof value === "number" ? value : value.toNumber();
}

function isPlacementBonuses(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function getActiveScoringRuleConfigs(
  client: RulesClient = prisma,
): Promise<ScoringRuleConfig[]> {
  const rules = await client.scoringRule.findMany({
    where: {
      activeTo: null,
    },
    orderBy: {
      activeFrom: "desc",
    },
  });
  const byPhase = new Map<MatchPhase, ScoringRuleConfig>();

  for (const fallbackRule of Object.values(defaultScoringRules)) {
    byPhase.set(fallbackRule.phase, fallbackRule);
  }

  for (const rule of rules) {
    if (!byPhase.has(rule.phase as MatchPhase)) {
      continue;
    }

    byPhase.set(rule.phase as MatchPhase, {
      phase: rule.phase as MatchPhase,
      oneTeamGoalsPoints: decimalToNumber(rule.oneTeamGoalsPoints),
      outcomePoints: decimalToNumber(rule.outcomePoints),
      scorelinePoints: decimalToNumber(rule.scorelinePoints),
      exactCapPoints: decimalToNumber(rule.exactCapPoints),
    });
  }

  return Object.values(defaultScoringRules).map((rule) => byPhase.get(rule.phase) ?? rule);
}

export async function getPlacementBonuses(
  client: RulesClient = prisma,
): Promise<PlacementBonuses> {
  const setting = await client.appSetting.findUnique({
    where: {
      key: "placement_bonus_points",
    },
  });

  if (!setting || !isPlacementBonuses(setting.value)) {
    return defaultPlacementBonuses;
  }

  return {
    champion: Number(setting.value.champion ?? defaultPlacementBonuses.champion),
    runner_up: Number(setting.value.runner_up ?? defaultPlacementBonuses.runner_up),
    third_place: Number(setting.value.third_place ?? defaultPlacementBonuses.third_place),
  };
}
