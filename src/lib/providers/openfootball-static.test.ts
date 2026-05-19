import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseOpenFootballStaticData } from "./openfootball-static";

describe("OpenFootball static provider", () => {
  it("normalizes the local World Cup 2026 seed into app fixtures", async () => {
    const seedRoot = path.join(process.cwd(), "prisma/seed-data/openfootball-2026");
    const [cupText, finalsText] = await Promise.all([
      readFile(path.join(seedRoot, "cup.txt"), "utf8"),
      readFile(path.join(seedRoot, "cup_finals.txt"), "utf8"),
    ]);
    const data = parseOpenFootballStaticData(cupText, finalsText);

    expect(data.teams).toHaveLength(48);
    expect(data.matches).toHaveLength(104);
    expect(data.matches[0]).toMatchObject({
      providerSource: "openfootball-2026",
      providerId: "M1",
      matchNumber: 1,
      phase: "group",
      status: "scheduled",
    });
    expect(data.matches.at(-1)).toMatchObject({
      providerId: "M104",
      matchNumber: 104,
      phase: "final",
    });
  });
});
