import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Script from "next/script";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bolão dos Facabundos 2026",
  description: "Bolão brasileiro da Copa do Mundo 2026.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
            <nav className="nav" aria-label="Navegação principal">
              <Link className="brand" href="/">
                <span className="mark">BF</span>
                <span>Bolão dos Facabundos 2026</span>
              </Link>
              <div className="menu">
                <Link href="/#ranking">Ranking</Link>
                <Link href="/matches">Jogos</Link>
                <Link href="/predictions">Comparar</Link>
                <Link href="/predictions/group">Palpites</Link>
                <Link href="/predictions/winners">Campeões</Link>
                <Link href="/rules">Regras</Link>
                <Link href="/admin">Admin</Link>
              </div>
              <div className="actions">
                <ThemeToggle />
                <Link className="button primary" href="/login">
                  Entrar
                </Link>
              </div>
            </nav>
          </header>
          {children}
          <footer>
            Visual baseado no conceito Noite de Copa. Tabela inicial publicada a
            partir de dados públicos do OpenFootball.
          </footer>
        </div>
      </body>
    </html>
  );
}
