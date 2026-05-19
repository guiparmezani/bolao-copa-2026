"use client";

import { useState } from "react";

const storageKey = "bolao-tema";

type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "dark";
  }

  const storedTheme = window.localStorage.getItem(storageKey);
  if (storedTheme === "dark" || storedTheme === "light") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(storageKey, nextTheme);
  }

  return (
    <button
      aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
      className="button theme-toggle"
      type="button"
      onClick={toggleTheme}
    >
      {theme === "dark" ? "Tema claro" : "Tema escuro"}
    </button>
  );
}
