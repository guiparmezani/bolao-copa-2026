import Link from "next/link";

import { getActiveScoringRuleConfigs, getPlacementBonuses } from "@/lib/rules";
import { phaseLabels } from "@/lib/tournament";

export const dynamic = "force-dynamic";

const placementLabels = {
  champion: "Campeão",
  runner_up: "Vice-campeão",
  third_place: "Terceiro lugar",
} as const;

function formatPoints(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value);
}

export default async function RulesPage() {
  const [rules, placementBonuses] = await Promise.all([
    getActiveScoringRuleConfigs(),
    getPlacementBonuses(),
  ]);

  return (
    <main className="matches-page">
      <section className="matches-header">
        <div>
          <span className="chip">Regras ativas</span>
          <h1>Como pontua o bolão</h1>
          <p>
            A pontuação vem da configuração ativa do sistema. Palpites de
            placar travam depois da confirmação, e palpites dos outros jogadores
            só aparecem quando o jogo termina.
          </p>
        </div>
        <Link className="button primary" href="/signup">
          Entrar no bolão
        </Link>
      </section>

      <section className="layout">
        <article className="card">
          <div className="card-head">
            <h2>Placares</h2>
            <span className="meta">Por fase</span>
          </div>
          <div className="rules-list">
            {rules.map((rule) => (
              <div className="rules-row" key={rule.phase}>
                <div>
                  <strong>{phaseLabels[rule.phase]}</strong>
                  <span>
                    Teto por placar exato: {formatPoints(rule.exactCapPoints)} pts
                  </span>
                </div>
                <div className="rules-metrics">
                  <span>{formatPoints(rule.oneTeamGoalsPoints)} gol de um time</span>
                  <span>{formatPoints(rule.outcomePoints)} resultado</span>
                  <span>{formatPoints(rule.scorelinePoints)} placar exato</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <h2>Envios e bloqueios</h2>
            <span className="meta">Padrão 2026</span>
          </div>
          <div className="info">
            <strong>Fase de grupos</strong>
            <span>
              Os 72 placares da fase de grupos devem ser enviados juntos. Depois
              da confirmação, eles ficam bloqueados.
            </span>
            <strong>Mata-mata</strong>
            <span>
              Só abre quando os confrontos dos 16 avos estiverem oficiais e sem
              placeholders. O peso dos 16 avos é igual ao das oitavas.
            </span>
            <strong>Campeão, vice e terceiro</strong>
            <span>
              Esses palpites são separados dos placares e seguem o prazo próprio
              definido para 16/07/2026 às 23:59.
            </span>
          </div>
        </article>
      </section>

      <section className="layout">
        <article className="card">
          <div className="card-head">
            <h2>Bônus finais</h2>
            <span className="meta">Colocações</span>
          </div>
          <div className="rules-list">
            {Object.entries(placementBonuses).map(([placement, points]) => (
              <div className="rules-row compact" key={placement}>
                <strong>
                  {placementLabels[placement as keyof typeof placementLabels]}
                </strong>
                <span className="pts">{formatPoints(points)} pts</span>
              </div>
            ))}
          </div>
        </article>

        <article className="card">
          <div className="card-head">
            <h2>Comparação pública</h2>
            <span className="meta">Sem copiar palpite aberto</span>
          </div>
          <div className="info">
            <strong>Todo mundo vê todo mundo</strong>
            <span>
              A página de comparação mostra os palpites confirmados de todos,
              mas só libera o placar de cada jogo depois que aquele jogo
              estiver encerrado.
            </span>
            <Link className="button" href="/predictions">
              Ver comparação
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
