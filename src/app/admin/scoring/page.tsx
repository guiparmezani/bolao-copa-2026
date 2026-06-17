import Link from "next/link";

import { AdminNotice } from "@/components/admin-notice";
import { requireAdminPage } from "@/lib/admin/auth";
import { formatAdminPoints } from "@/lib/admin/format";
import { getActiveScoringRuleConfigs, getPlacementBonuses } from "@/lib/rules";
import { phaseLabels } from "@/lib/tournament";

export const dynamic = "force-dynamic";

type AdminScoringPageProps = {
  searchParams?: Promise<{ aviso?: string; erro?: string; mensagem?: string }>;
};

export default async function AdminScoringPage({ searchParams }: AdminScoringPageProps) {
  await requireAdminPage();
  const { aviso, erro, mensagem } = (await searchParams) ?? {};
  const [rules, placementBonuses] = await Promise.all([
    getActiveScoringRuleConfigs(),
    getPlacementBonuses(),
  ]);

  return (
    <main className="admin-page">
      <section className="matches-header">
        <div><h1>Pontuação</h1><p>Alterações criam novas versões de regra e devem ser seguidas de recálculo.</p></div>
        <Link className="button" href="/admin">Voltar ao admin</Link>
      </section>
      <AdminNotice aviso={aviso} erro={erro} mensagem={mensagem} />
      <section className="schedule-list">
        {rules.map((rule) => (
          <article className="card" key={rule.phase}>
            <div className="card-head"><h2>{phaseLabels[rule.phase]}</h2><span className="meta">Regra ativa</span></div>
            <form className="admin-form-grid" action="/api/admin/scoring-rules" method="post">
              <input type="hidden" name="phase" value={rule.phase} />
              <label><span>Gol de um time</span><input name="oneTeamGoalsPoints" type="number" step="0.5" defaultValue={rule.oneTeamGoalsPoints} /></label>
              <label><span>Resultado</span><input name="outcomePoints" type="number" step="0.5" defaultValue={rule.outcomePoints} /></label>
              <label><span>Placar exato</span><input name="scorelinePoints" type="number" step="0.5" defaultValue={rule.scorelinePoints} /></label>
              <label><span>Teto exato</span><input name="exactCapPoints" type="number" step="0.5" defaultValue={rule.exactCapPoints} /></label>
              <button className="button" type="submit">Salvar nova versão</button>
            </form>
          </article>
        ))}
      </section>
      <section className="card admin-actions">
        <div className="card-head"><h2>Bônus finais</h2><span className="meta">Ativos</span></div>
        <div className="rules-list">
          <div className="rules-row compact"><strong>Campeão</strong><span>{formatAdminPoints(placementBonuses.champion)} pts</span></div>
          <div className="rules-row compact"><strong>Vice</strong><span>{formatAdminPoints(placementBonuses.runner_up)} pts</span></div>
          <div className="rules-row compact"><strong>Terceiro</strong><span>{formatAdminPoints(placementBonuses.third_place)} pts</span></div>
        </div>
        <form className="admin-form-grid" action="/api/admin/leaderboard/recompute" method="post">
          <button className="button primary" type="submit">Recalcular ranking</button>
        </form>
      </section>
    </main>
  );
}
