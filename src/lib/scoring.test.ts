import { describe, expect, it } from "vitest";

import { defaultScoringRules, scorePrediction } from "./scoring";

describe("scorePrediction", () => {
  const groupRule = defaultScoringRules.group;

  it("scores an exact group prediction as one-team goals plus outcome plus scoreline", () => {
    expect(
      scorePrediction({
        predictedHomeGoals: 2,
        predictedAwayGoals: 0,
        actualHomeGoals: 2,
        actualAwayGoals: 0,
        rule: groupRule,
      }),
    ).toMatchObject({
      pending: false,
      oneTeamGoalsPoints: 1,
      outcomePoints: 2,
      scorelinePoints: 3,
      totalPoints: 6,
      isExact: true,
      isOutcomeCorrect: true,
      isOneTeamGoalsCorrect: true,
    });
  });

  it("scores home goals plus winner for a group match", () => {
    expect(
      scorePrediction({
        predictedHomeGoals: 2,
        predictedAwayGoals: 0,
        actualHomeGoals: 2,
        actualAwayGoals: 1,
        rule: groupRule,
      }).totalPoints,
    ).toBe(3);
  });

  it("scores away goals plus winner for a group match", () => {
    expect(
      scorePrediction({
        predictedHomeGoals: 1,
        predictedAwayGoals: 0,
        actualHomeGoals: 2,
        actualAwayGoals: 0,
        rule: groupRule,
      }).totalPoints,
    ).toBe(3);
  });

  it("scores draw outcome without one-team goals for a different draw score", () => {
    expect(
      scorePrediction({
        predictedHomeGoals: 1,
        predictedAwayGoals: 1,
        actualHomeGoals: 2,
        actualAwayGoals: 2,
        rule: groupRule,
      }),
    ).toMatchObject({
      outcomePoints: 2,
      oneTeamGoalsPoints: 0,
      totalPoints: 2,
      isOutcomeCorrect: true,
      isOneTeamGoalsCorrect: false,
    });
  });

  it("scores one away team goal only when the outcome is wrong", () => {
    expect(
      scorePrediction({
        predictedHomeGoals: 0,
        predictedAwayGoals: 1,
        actualHomeGoals: 2,
        actualAwayGoals: 1,
        rule: groupRule,
      }),
    ).toMatchObject({
      outcomePoints: 0,
      oneTeamGoalsPoints: 1,
      totalPoints: 1,
      isOutcomeCorrect: false,
      isOneTeamGoalsCorrect: true,
    });
  });

  it("uses configurable knockout phase weights", () => {
    expect(
      scorePrediction({
        predictedHomeGoals: 3,
        predictedAwayGoals: 2,
        actualHomeGoals: 3,
        actualAwayGoals: 2,
        rule: defaultScoringRules.final,
      }).totalPoints,
    ).toBe(18);
  });

  it("returns pending when the recorded match score is missing", () => {
    expect(
      scorePrediction({
        predictedHomeGoals: 1,
        predictedAwayGoals: 0,
        actualHomeGoals: null,
        actualAwayGoals: null,
        rule: groupRule,
      }),
    ).toMatchObject({
      pending: true,
      totalPoints: 0,
    });
  });

  it("ignores penalty shootout data because only recorded goals are passed to scoring", () => {
    expect(
      scorePrediction({
        predictedHomeGoals: 1,
        predictedAwayGoals: 1,
        actualHomeGoals: 1,
        actualAwayGoals: 1,
        rule: defaultScoringRules.round_of_32,
      }).totalPoints,
    ).toBe(9);
  });
});
