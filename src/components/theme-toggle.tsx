"use client";

import { useSyncExternalStore } from "react";

const storageKey = "bolao-tema";
const themeChangeEvent = "bolao-tema-change";

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

function getServerTheme(): Theme {
  return "dark";
}

function subscribeToTheme(onThemeChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
  const syncTheme = () => {
    document.documentElement.dataset.theme = getInitialTheme();
    onThemeChange();
  };

  mediaQuery.addEventListener("change", syncTheme);
  window.addEventListener("storage", syncTheme);
  window.addEventListener(themeChangeEvent, syncTheme);

  return () => {
    mediaQuery.removeEventListener("change", syncTheme);
    window.removeEventListener("storage", syncTheme);
    window.removeEventListener(themeChangeEvent, syncTheme);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getInitialTheme,
    getServerTheme,
  );

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(storageKey, nextTheme);
    window.dispatchEvent(new Event(themeChangeEvent));
  }

  const label = theme === "dark" ? "Tema claro" : "Tema escuro";

  return (
    <button
      aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
      className="button theme-toggle"
      type="button"
      onClick={toggleTheme}
    >
      {label}
    </button>
  );
}
