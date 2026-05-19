import Link from "next/link";
import {
  leaderboardPreview,
  publicStats,
  schedulePreview,
} from "@/lib/mock-data";

export default function Home() {
  return (
    <main>
      <section className="hero" id="inicio">
        <div className="hero-grid">
          <div className="hero-copy" id="entrar">
            <div className="chips">
              <span className="chip">Tabela pública</span>
              <span className="chip">Copa 2026</span>
            </div>
            <h1>A central da resenha durante a Copa.</h1>
            <p>
              Ranking, calendário e regras em uma experiência direta para
              acompanhar o bolão sem expor palpites que ainda não fecharam.
            </p>
            <div className="chips">
              <Link className="button primary" href="/signup">
                Criar conta
              </Link>
              <Link className="button" href="/matches">
                Ver jogos
              </Link>
            </div>
          </div>

          <aside className="card" aria-label="Jogo em destaque">
            <div className="card-head">
              <h2>Jogo em destaque</h2>
              <span className="meta live">Ao vivo</span>
            </div>
            <div className="feature-match">
              <div className="teams">
                <span className="team">🇧🇷 Brasil</span>
                <span className="score">2 x 1</span>
                <span className="team">🇲🇦 Marrocos</span>
              </div>
              <div className="timeline">
                <span aria-hidden="true">&nbsp;</span>
              </div>
              <span className="meta">
                Grupo G • 63 minutos • placar oficial sincronizado
              </span>
            </div>
            <div className="metrics">
              {publicStats.map((stat) => (
                <div className="metric" key={stat.label}>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className="band" aria-label="Prévia pública">
        <div className="layout">
          <article className="card" id="ranking">
            <div className="card-head">
              <h2>Ranking geral</h2>
              <span className="meta">Atualizado às 18:42</span>
            </div>
            <div>
              {leaderboardPreview.map((entry) => (
                <div className="row" key={entry.rank}>
                  <span className="rank">{entry.rank}</span>
                  <span className="name">
                    <strong>{entry.name}</strong>
                    <span>
                      {entry.exactScores} exatos • {entry.outcomes} vencedores
                    </span>
                  </span>
                  <span className="pts">{entry.points}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="card" id="jogos">
            <div className="card-head">
              <h2>Próximos jogos</h2>
              <span className="meta">Horário de Brasília</span>
            </div>
            <div className="matches">
              {schedulePreview.map((match) => (
                <div className="match-mini" key={match.id}>
                  <div className="line">
                    <span>
                      {match.dateLabel} • {match.timeLabel}
                    </span>
                    <span>{match.statusLabel}</span>
                  </div>
                  <strong>{match.teamsLabel}</strong>
                </div>
              ))}
            </div>
            <div className="info compact-info">
              <Link className="button" href="/matches">
                Ver tabela completa
              </Link>
            </div>
          </article>
        </div>

        <div className="layout">
          <article className="card" id="regras">
            <div className="card-head">
              <h2>Como funciona</h2>
              <span className="meta">Modelo 2022</span>
            </div>
            <div className="info">
              <strong>Dois momentos para palpitar</strong>
              <span>
                Primeiro entram os placares da fase de grupos. Depois que os
                confrontos do mata-mata estiverem definidos, abre a segunda
                rodada de palpites.
              </span>
              <Link className="button" href="/rules">
                Ler regras completas
              </Link>
            </div>
          </article>

          <article className="card">
            <div className="card-head">
              <h2>Pronto para entrar?</h2>
              <span className="meta">Conta obrigatória</span>
            </div>
            <div className="info">
              <strong>Seus palpites ficam protegidos</strong>
              <span>
                Depois de entrar, você vê suas telas privadas de envio. A
                página inicial continua pública e sem dados restritos.
              </span>
              <Link className="button primary" href="/signup">
                Criar conta ou entrar
              </Link>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
