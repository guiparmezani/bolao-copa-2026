"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type SiteNavProps = {
  accountHref: string;
  accountLabel: string;
  isAuthenticated: boolean;
};

const navLinks = [
  { href: "/", label: "Início" },
  { href: "/ranking", label: "Ranking" },
  { href: "/matches", label: "Jogos" },
  { href: "/predictions", label: "Palpites" },
  { href: "/rules", label: "Regras" },
];

function HeaderLogout({ onClick }: { onClick?: () => void }) {
  return (
    <form action="/api/auth/logout" className="nav-logout-form" method="post">
      <button className="button" onClick={onClick} type="submit">
        Sair
      </button>
    </form>
  );
}

export function SiteNav({ accountHref, accountLabel, isAuthenticated }: SiteNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    function handleScroll() {
      const currentScrollY = Math.max(window.scrollY, 0);
      const isScrollingDown = currentScrollY > lastScrollY.current;

      setIsHidden(!isOpen && isScrollingDown && currentScrollY > 100);
      lastScrollY.current = currentScrollY;
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isOpen]);

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <header className="site-header" data-hidden={isHidden}>
      <nav className="nav" aria-label="Navegação principal">
        <Link className="brand" href="/" onClick={closeMenu}>
          <span className="mark">BF</span>
          <span>Bolão dos Facabundos 2026</span>
        </Link>

        <div className="menu">
          <Link href="/ranking">Ranking</Link>
          <Link href="/matches">Jogos</Link>
          <Link href="/predictions">Palpites</Link>
          <Link href="/rules">Regras</Link>
        </div>

        <div className="actions desktop-actions">
          <Link className="button primary" href={accountHref}>
            {accountLabel}
          </Link>
          {isAuthenticated ? <HeaderLogout /> : null}
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
            <Link className="button primary" href={accountHref} onClick={closeMenu}>
              {accountLabel}
            </Link>
            {isAuthenticated ? <HeaderLogout onClick={closeMenu} /> : null}
          </div>
        </div>
      </nav>
    </header>
  );
}
