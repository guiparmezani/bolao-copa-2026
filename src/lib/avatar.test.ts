import { describe, expect, it } from "vitest";

import { validateAvatarDataUrl } from "./avatar";

const transparentPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

describe("validateAvatarDataUrl", () => {
  it("accepts a valid PNG data URL", () => {
    expect(validateAvatarDataUrl(transparentPng)).toMatchObject({
      ok: true,
      value: {
        mimeType: "image/png",
      },
    });
  });

  it("accepts null for avatar removal", () => {
    expect(validateAvatarDataUrl(null)).toEqual({ ok: true, value: null });
  });

  it("rejects non-image data URLs", () => {
    expect(validateAvatarDataUrl("data:text/plain;base64,SGVsbG8=")).toMatchObject({
      ok: false,
    });
  });
});
