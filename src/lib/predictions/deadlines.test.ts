import { describe, expect, it } from "vitest";
import {
  areRoundOf32FixturesResolved,
  defaultGroupSubmissionDeadlineIso,
  defaultKnockoutSubmissionDeadlineIso,
  defaultPlacementSubmissionDeadlineIso,
  getGroupSubmissionWindow,
  getKnockoutSubmissionWindow,
  getPlacementSubmissionWindow,
  isJsonEnabled,
  isBeforeOrAtDeadline,
  parseSettingDate,
} from "./deadlines";

describe("group prediction deadlines", () => {
  it("uses the default Sao Paulo close time as UTC", () => {
    expect(defaultGroupSubmissionDeadlineIso).toBe("2026-06-12T02:59:00.000Z");
    expect(defaultKnockoutSubmissionDeadlineIso).toBe("2026-06-28T02:59:00.000Z");
    expect(defaultPlacementSubmissionDeadlineIso).toBe("2026-07-17T02:59:00.000Z");
  });

  it("keeps submissions open until the exact deadline instant", () => {
    const deadline = new Date(defaultGroupSubmissionDeadlineIso);

    expect(isBeforeOrAtDeadline(new Date("2026-06-12T02:58:59.000Z"), deadline)).toBe(
      true,
    );
    expect(isBeforeOrAtDeadline(new Date("2026-06-12T02:59:00.000Z"), deadline)).toBe(
      true,
    );
    expect(isBeforeOrAtDeadline(new Date("2026-06-12T02:59:01.000Z"), deadline)).toBe(
      false,
    );
  });

  it("parses string and object app setting dates", () => {
    expect(parseSettingDate("2026-06-12T02:59:00.000Z")?.toISOString()).toBe(
      "2026-06-12T02:59:00.000Z",
    );
    expect(parseSettingDate({ iso: "2026-06-12T02:59:00.000Z" })?.toISOString()).toBe(
      "2026-06-12T02:59:00.000Z",
    );
    expect(parseSettingDate("not-a-date")).toBeNull();
  });

  it("returns a Portuguese status label", () => {
    expect(
      getGroupSubmissionWindow(
        new Date("2026-06-12T02:59:01.000Z"),
        new Date(defaultGroupSubmissionDeadlineIso),
      ).statusLabel,
    ).toBe("Encerrado");
  });

  it("opens knockout only when fixtures are resolved and the setting enables it", () => {
    const deadline = new Date(defaultKnockoutSubmissionDeadlineIso);
    const unresolved = Array.from({ length: 16 }, () => ({
      awayPlaceholder: "2A",
      awayTeamId: null,
      homePlaceholder: "1A",
      homeTeamId: null,
    }));
    const resolved = Array.from({ length: 16 }, (_, index) => ({
      awayPlaceholder: null,
      awayTeamId: `away-${index}`,
      homePlaceholder: null,
      homeTeamId: `home-${index}`,
    }));

    expect(areRoundOf32FixturesResolved(unresolved)).toBe(false);
    expect(areRoundOf32FixturesResolved(resolved)).toBe(true);
    expect(
      getKnockoutSubmissionWindow({
        deadline,
        enabledBySetting: false,
        now: new Date("2026-06-27T12:00:00.000Z"),
        roundOf32Resolved: false,
      }).statusLabel,
    ).toBe("Bloqueado");
    expect(
      getKnockoutSubmissionWindow({
        deadline,
        enabledBySetting: true,
        now: new Date("2026-06-27T12:00:00.000Z"),
        roundOf32Resolved: false,
      }).statusLabel,
    ).toBe("Bloqueado");
    expect(
      getKnockoutSubmissionWindow({
        deadline,
        enabledBySetting: false,
        now: new Date("2026-06-27T12:00:00.000Z"),
        roundOf32Resolved: true,
      }).statusLabel,
    ).toBe("Bloqueado");
    expect(
      getKnockoutSubmissionWindow({
        deadline,
        enabledBySetting: true,
        now: new Date("2026-06-27T12:00:00.000Z"),
        roundOf32Resolved: true,
      }).isOpen,
    ).toBe(true);
  });

  it("locks placement picks after the default deadline", () => {
    const deadline = new Date(defaultPlacementSubmissionDeadlineIso);

    expect(
      getPlacementSubmissionWindow(
        new Date("2026-07-17T02:59:00.000Z"),
        deadline,
        true,
      ).isOpen,
    ).toBe(true);
    expect(
      getPlacementSubmissionWindow(
        new Date("2026-07-17T02:59:01.000Z"),
        deadline,
        true,
      ).isOpen,
    ).toBe(false);
    expect(getPlacementSubmissionWindow(new Date(), deadline, false).statusLabel).toBe(
      "Bloqueado",
    );
  });

  it("parses enabled JSON settings conservatively", () => {
    expect(isJsonEnabled(true)).toBe(true);
    expect(isJsonEnabled("true")).toBe(true);
    expect(isJsonEnabled(false)).toBe(false);
    expect(isJsonEnabled(null)).toBe(false);
  });
});
