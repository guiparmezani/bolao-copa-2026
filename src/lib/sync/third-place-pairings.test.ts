import { describe, expect, it } from "vitest";

import { getThirdPlacePairing } from "./third-place-pairings";

describe("FIFA third-place pairings", () => {
  it("resolves an Annexe C combination by qualified group letters", () => {
    expect(getThirdPlacePairing(["E", "F", "G", "H", "I", "J", "K", "L"])).toEqual({
      "1A": "E",
      "1B": "J",
      "1D": "I",
      "1E": "F",
      "1G": "H",
      "1I": "G",
      "1K": "L",
      "1L": "K",
    });
  });

  it("requires exactly eight unique valid group letters", () => {
    expect(getThirdPlacePairing(["A", "B", "C"])).toBeNull();
    expect(getThirdPlacePairing(["A", "B", "C", "D", "E", "F", "G", "Z"])).toBeNull();
  });
});
