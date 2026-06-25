import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";

import { writeAuditLog } from "@/lib/admin/audit";
import { redirectBack, requireAdminApi, shouldRedirectBack } from "@/lib/admin/auth";
import { asString, readRequestData } from "@/lib/admin/forms";
import { prisma } from "@/lib/prisma";

const allowedSettings = new Set([
  "group_submission_deadline",
  "knockout_submission_deadline",
  "knockout_round_of_16_submission_deadline",
  "knockout_quarter_final_submission_deadline",
  "knockout_semi_final_submission_deadline",
  "knockout_third_place_submission_deadline",
  "knockout_final_submission_deadline",
  "placement_submission_deadline",
  "knockout_predictions_enabled",
  "placement_predictions_enabled",
  "prediction_reveal_policy",
  "signup_policy",
  "primary_provider",
  "fallback_provider",
  "sync_interval_minutes",
  "automatic_sync_paused",
]);

function parseJsonSetting(key: string, rawValue: string): Prisma.InputJsonValue {
  if (key.endsWith("_enabled") || key === "automatic_sync_paused") {
    return rawValue === "true";
  }

  if (key === "sync_interval_minutes") {
    return Number(rawValue);
  }

  return rawValue;
}

export async function POST(request: NextRequest) {
  const { response, user } = await requireAdminApi(request, true);

  if (response || !user) {
    return response;
  }

  const data = await readRequestData(request);
  const key = asString(data.key);
  const rawValue = asString(data.value);

  if (!allowedSettings.has(key) || !rawValue) {
    return Response.json({ error: "Configuração inválida." }, { status: 400 });
  }

  const before = await prisma.appSetting.findUnique({ where: { key } });
  const after = await prisma.appSetting.upsert({
    where: { key },
    update: {
      value: parseJsonSetting(key, rawValue),
      updatedByUserId: user.id,
    },
    create: {
      key,
      value: parseJsonSetting(key, rawValue),
      updatedByUserId: user.id,
    },
  });

  await writeAuditLog({
    actorUserId: user.id,
    action: "setting.update",
    targetEntity: "app_setting",
    targetId: key,
    before,
    after,
  });

  if (shouldRedirectBack(request)) {
    return redirectBack(request, "/admin/settings");
  }

  return Response.json({ ok: true, setting: after });
}
