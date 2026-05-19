import { describe, expect, it } from "vitest";

import { canRevealMatchPredictions } from "./reveal";

describe("canRevealMatchPredictions", () => {
  it("reveals predictions only after the official score is final", () => {
    expect(
      canRevealMatchPredictions({
        awayGoals: 1,
        homeGoals: 2,
        status: "finished",
      }),
    ).toBe(true);
  });

  it("keeps predictions hidden while the match is live", () => {
    expect(
      canRevealMatchPredictions({
        awayGoals: 1,
        homeGoals: 2,
        status: "live",
      }),
    ).toBe(false);
  });

  it("keeps predictions hidden if a finished match is missing its score", () => {
    expect(
      canRevealMatchPredictions({
        awayGoals: null,
        homeGoals: 2,
        status: "finished",
      }),
    ).toBe(false);
  });
});
