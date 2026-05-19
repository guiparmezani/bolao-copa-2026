"use client";

import Link from "next/link";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

type SiteNavProps = {
  accountHref: string;
  accountLabel: string;
};

const navLinks = [
  { href: "/", label: "Início" },
  { href: "/#ranking", label: "Ranking" },
  { href: "/matches", label: "Jogos" },
  { href: "/predictions", label: "Palpites" },
  { href: "/rules", label: "Regras" },
];

export function SiteNav({ accountHref, accountLabel }: SiteNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <nav className="nav" aria-label="Navegação principal">
      <Link className="brand" href="/" onClick={closeMenu}>
        <span className="mark">BF</span>
        <span>Bolão dos Facabundos 2026</span>
      </Link>

      <div className="menu">
        <Link href="/#ranking">Ranking</Link>
        <Link href="/matches">Jogos</Link>
        <Link href="/predictions">Palpites</Link>
        <Link href="/rules">Regras</Link>
      </div>

      <div className="actions desktop-actions">
        <ThemeToggle />
        <Link className="button primary" href={accountHref}>
          {accountLabel}
        </Link>
      </div>

      <button
        aria-controls="mobile-nav-menu"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
        className="mobile-menu-button"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      <div
        className="mobile-nav-panel"
        data-open={isOpen}
        hidden={!isOpen}
        id="mobile-nav-menu"
      >
        <div className="mobile-nav-links">
          {navLinks.map((link) => (
            <Link href={link.href} key={link.href} onClick={closeMenu}>
              {link.label}
            </Link>
          ))}
        </div>
        <div className="mobile-nav-actions">
          <ThemeToggle />
          <Link className="button primary" href={accountHref} onClick={closeMenu}>
            {accountLabel}
          </Link>
        </div>
      </div>
    </nav>
  );
}
