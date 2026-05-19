import "server-only";

import { NextRequest } from "next/server";

export async function readRequestData(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await request.json()) as Record<string, unknown>;
  }

  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

export function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function asNullableString(value: unknown) {
  const stringValue = asString(value);
  return stringValue.length > 0 ? stringValue : null;
}

export function asNumber(value: unknown) {
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function asDate(value: unknown) {
  const stringValue = asString(value);

  if (!stringValue) {
    return null;
  }

  const date = new Date(stringValue);
  return Number.isNaN(date.getTime()) ? null : date;
}
