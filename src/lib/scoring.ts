export type MatchPhase =
  | "group"
  | "round_of_32"
  | "round_of_16"
  | "quarter_final"
  | "semi_final"
  | "third_place"
  | "final";

export type ScoringRuleConfig = {
  phase: MatchPhase;
  oneTeamGoalsPoints: number;
  outcomePoints: number;
  scorelinePoints: number;
  exactCapPoints: number;
};

export type ScorePredictionInput = {
  predictedHomeGoals: number;
  predictedAwayGoals: number;
  actualHomeGoals: number | null | undefined;
  actualAwayGoals: number | null | undefined;
  rule: ScoringRuleConfig;
};

export type ScorePredictionResult = {
  pending: boolean;
  oneTeamGoalsPoints: number;
  outcomePoints: number;
  scorelinePoints: number;
  totalPoints: number;
  isExact: boolean;
  isOutcomeCorrect: boolean;
  isOneTeamGoalsCorrect: boolean;
};

export const defaultScoringRules: Record<MatchPhase, ScoringRuleConfig> = {
  group: {
    phase: "group",
    oneTeamGoalsPoints: 1,
    outcomePoints: 2,
    scorelinePoints: 3,
    exactCapPoints: 6,
  },
  round_of_32: {
    phase: "round_of_32",
    oneTeamGoalsPoints: 1.5,
    outcomePoints: 3,
    scorelinePoints: 4.5,
    exactCapPoints: 9,
  },
  round_of_16: {
    phase: "round_of_16",
    oneTeamGoalsPoints: 1.5,
    outcomePoints: 3,
    scorelinePoints: 4.5,
    exactCapPoints: 9,
  },
  quarter_final: {
    phase: "quarter_final",
    oneTeamGoalsPoints: 1.5,
    outcomePoints: 3,
    scorelinePoints: 4.5,
    exactCapPoints: 9,
  },
  semi_final: {
    phase: "semi_final",
    oneTeamGoalsPoints: 2,
    outcomePoints: 4,
    scorelinePoints: 6,
    exactCapPoints: 12,
  },
  third_place: {
    phase: "third_place",
    oneTeamGoalsPoints: 3,
    outcomePoints: 6,
    scorelinePoints: 9,
    exactCapPoints: 18,
  },
  final: {
    phase: "final",
    oneTeamGoalsPoints: 3,
    outcomePoints: 6,
    scorelinePoints: 9,
    exactCapPoints: 18,
  },
};

function outcome(homeGoals: number, awayGoals: number) {
  return Math.sign(homeGoals - awayGoals);
}

export function scorePrediction(input: ScorePredictionInput): ScorePredictionResult {
  const { actualHomeGoals, actualAwayGoals, predictedHomeGoals, predictedAwayGoals, rule } = input;

  if (actualHomeGoals === null || actualHomeGoals === undefined || actualAwayGoals === null ||
    actualAwayGoals === undefined) {
    return {
      pending: true,
      oneTeamGoalsPoints: 0,
      outcomePoints: 0,
      scorelinePoints: 0,
      totalPoints: 0,
      isExact: false,
      isOutcomeCorrect: false,
      isOneTeamGoalsCorrect: false,
    };
  }

  const isExact = predictedHomeGoals === actualHomeGoals && predictedAwayGoals === actualAwayGoals;
  const isOutcomeCorrect =
    outcome(predictedHomeGoals, predictedAwayGoals) === outcome(actualHomeGoals, actualAwayGoals);
  const isOneTeamGoalsCorrect =
    (predictedHomeGoals === actualHomeGoals || predictedAwayGoals === actualAwayGoals);

  const scorelinePoints = isExact ? rule.scorelinePoints : 0;
  const outcomePoints = isOutcomeCorrect ? rule.outcomePoints : 0;
  const oneTeamGoalsPoints = isOneTeamGoalsCorrect ? rule.oneTeamGoalsPoints : 0;
  const totalPoints = Math.min(
    scorelinePoints + outcomePoints + oneTeamGoalsPoints,
    rule.exactCapPoints,
  );

  return {
    pending: false,
    oneTeamGoalsPoints,
    outcomePoints,
    scorelinePoints,
    totalPoints,
    isExact,
    isOutcomeCorrect,
    isOneTeamGoalsCorrect,
  };
}
