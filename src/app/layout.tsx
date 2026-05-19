import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Script from "next/script";
import { SiteNav } from "@/components/site-nav";
import { getCurrentUser } from "@/lib/auth/session";
import "./globals.css";

const siteName = "Bolão dos Facabundos Copa 2026";
const siteDescription =
  "Palpites, ranking e jogos da Copa do Mundo 2026 no Bolão dos Facabundos.";
const appUrl = process.env.APP_URL?.trim() || "http://localhost:3000";

export const metadata: Metadata = {
  applicationName: siteName,
  metadataBase: new URL(appUrl),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
  },
  openGraph: {
    title: siteName,
    description: siteDescription,
    url: "/",
    siteName,
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: siteName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
    images: ["/opengraph-image"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark light",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const accountHref = user ? (user.role === "admin" ? "/admin" : "/dashboard") : "/login";
  const accountLabel = user ? (user.role === "admin" ? "Admin" : "Painel") : "Entrar";

  return (
    <html data-scroll-behavior="smooth" lang="pt-BR" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            (() => {
              const storageKey = "bolao-tema";
              const storedTheme = window.localStorage.getItem(storageKey);
              const theme = storedTheme === "dark" || storedTheme === "light"
                ? storedTheme
                : window.matchMedia("(prefers-color-scheme: light)").matches
                  ? "light"
                  : "dark";
              document.documentElement.dataset.theme = theme;
            })();
          `}
        </Script>
        <div className="shell">
          <header>
            <SiteNav accountHref={accountHref} accountLabel={accountLabel} />
          </header>
          {children}
          <footer className="site-footer">
            <div className="footer-panel">
              <div className="footer-brand">
                <Link className="footer-brand-link" href="/">
                  <span className="mark">BF</span>
                  <span>Bolão dos Facabundos Copa 2026</span>
                </Link>
                <p>
                  Palpites, ranking e jogos da Copa do Mundo 2026 em um bolão
                  privado entre amigos.
                </p>
              </div>

              <nav className="footer-links" aria-label="Links do rodapé">
                <section className="footer-group">
                  <h2>Bolão</h2>
                  <Link href="/">Início</Link>
                  <Link href="/#ranking">Ranking</Link>
                  <Link href="/matches">Jogos</Link>
                  <Link href="/rules">Regras</Link>
                </section>
                <section className="footer-group">
                  <h2>Palpites</h2>
                  <Link href="/predictions">Comparar</Link>
                  <Link href="/predictions/group">Fase de grupos</Link>
                  <Link href="/predictions/winners">Campeões</Link>
                </section>
                <section className="footer-group">
                  <h2>Conta</h2>
                  <Link href={accountHref}>{accountLabel}</Link>
                  {!user ? <Link href="/signup">Criar conta</Link> : null}
                  <Link href="/rules">Pontuação</Link>
                </section>
              </nav>
            </div>

            <div className="footer-bottom">
              <span>© 2026 Bolão dos Facabundos. Todos os direitos reservados.</span>
              <span>Interface em português do Brasil.</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
