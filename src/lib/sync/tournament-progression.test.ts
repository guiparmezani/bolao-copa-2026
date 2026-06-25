import { describe, expect, it } from "vitest";

import {
  computeGroupProgression,
  type GroupMatch,
  type TeamSeed,
} from "./tournament-progression";

function team(id: string, nameEn = id): TeamSeed {
  return {
    id,
    providerId: id.toLowerCase(),
    nameEn,
    groupName: "Grupo A",
    fairPlayPoints: null,
    fifaRankingCurrent: null,
  };
}

function match(homeTeamId: string, awayTeamId: string, homeGoals: number, awayGoals: number): GroupMatch {
  return {
    groupName: "Grupo A",
    homeTeamId,
    awayTeamId,
    homeGoals,
    awayGoals,
    status: "finished",
  };
}

describe("tournament progression standings", () => {
  it("uses head-to-head before overall goal difference for same-group point ties", () => {
    const progression = computeGroupProgression(
      "Grupo A",
      [team("A"), team("B"), team("C"), team("D")],
      [
        match("A", "B", 1, 0),
        match("A", "C", 0, 3),
        match("A", "D", 2, 0),
        match("B", "C", 4, 0),
        match("B", "D", 4, 0),
        match("C", "D", 1, 1),
      ],
    );

    expect(progression.complete).toBe(true);
    expect(progression.standings.map((standing) => standing.teamId)).toEqual(["A", "B", "C", "D"]);
    expect(progression.standings.map((standing) => standing.points)).toEqual([6, 6, 4, 1]);
  });

  it("marks incomplete groups as not complete while still calculating current points", () => {
    const progression = computeGroupProgression(
      "Grupo A",
      [team("A"), team("B"), team("C"), team("D")],
      [
        match("A", "B", 2, 0),
        match("C", "D", 1, 1),
      ],
    );

    expect(progression.complete).toBe(false);
    expect(progression.standings.find((standing) => standing.teamId === "A")?.points).toBe(3);
  });
});
