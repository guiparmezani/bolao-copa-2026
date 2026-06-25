import Link from "next/link";

import { requireAdminPage } from "@/lib/admin/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const editableSettings = [
  ["group_submission_deadline", "Prazo fase de grupos"],
  ["knockout_submission_deadline", "Prazo 16 avos"],
  ["knockout_round_of_16_submission_deadline", "Prazo oitavas"],
  ["knockout_quarter_final_submission_deadline", "Prazo quartas"],
  ["knockout_semi_final_submission_deadline", "Prazo semi"],
  ["knockout_third_place_submission_deadline", "Prazo 3º lugar"],
  ["knockout_final_submission_deadline", "Prazo final"],
  ["knockout_predictions_enabled", "Mata-mata habilitado"],
  ["placement_predictions_enabled", "Colocações habilitadas"],
  ["prediction_reveal_policy", "Política de revelação"],
  ["signup_policy", "Política de cadastro"],
  ["primary_provider", "Provider primário"],
  ["fallback_provider", "Provider fallback"],
  ["sync_interval_minutes", "Intervalo de sync"],
  ["automatic_sync_paused", "Sync pausado"],
] as const;

export default async function AdminSettingsPage() {
  await requireAdminPage();
  const settings = await prisma.appSetting.findMany({ orderBy: { key: "asc" } });
  const byKey = new Map(settings.map((setting) => [setting.key, setting]));

  return (
    <main className="admin-page">
      <section className="matches-header">
        <div><h1>Configurações</h1><p>Prazos, políticas e provider. Salvos como JSON simples.</p></div>
        <Link className="button" href="/admin">Voltar ao admin</Link>
      </section>
      <section className="schedule-list">
        {editableSettings.map(([key, label]) => {
          const setting = byKey.get(key);
          return (
            <article className="card" key={key}>
              <form className="admin-form-grid" action="/api/admin/settings" method="post">
                <input type="hidden" name="key" value={key} />
                <label><span>{label}</span><input name="value" defaultValue={setting ? String(setting.value) : ""} /></label>
                <span className="meta">{key}</span>
                <button className="button" type="submit">Salvar</button>
              </form>
            </article>
          );
        })}
      </section>
    </main>
  );
}
