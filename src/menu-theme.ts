import type { CSSProperties } from "react";
import type { MenuData, MenuFeatures, MenuStyle, MenuTheme, ThemeVariant } from "./menu-types";

export const defaultFeatures: Required<MenuFeatures> = {
  showFeatured: true,
  showCombos: true,
  showDescriptions: true,
  showTastingNotes: true,
  showServingDetails: true
};

const themePresets: Record<ThemeVariant, Required<MenuTheme>> = {
  cocktail: {
    variant: "cocktail",
    accent: "#e879f9",
    background: "#130f18",
    surface: "#211827",
    text: "#fff7ed",
    muted: "#c4b5fd"
  },
  malt: {
    variant: "malt",
    accent: "#d8a657",
    background: "#17110d",
    surface: "#241a12",
    text: "#fff7ed",
    muted: "#c9b49a"
  },
  cigar: {
    variant: "cigar",
    accent: "#c08457",
    background: "#18120f",
    surface: "#251a15",
    text: "#fff7ed",
    muted: "#cbb8a7"
  },
  wine: {
    variant: "wine",
    accent: "#e11d48",
    background: "#160d13",
    surface: "#24111b",
    text: "#fff1f2",
    muted: "#f0b6c2"
  },
  beer: {
    variant: "beer",
    accent: "#fbbf24",
    background: "#15120b",
    surface: "#242013",
    text: "#fff7d6",
    muted: "#d7c68a"
  },
  multi: {
    variant: "multi",
    accent: "#38bdf8",
    background: "#101418",
    surface: "#19212a",
    text: "#f8fafc",
    muted: "#a7b6c7"
  }
};

export function themeVars(theme: Required<MenuTheme>) {
  return {
    "--accent": theme.accent,
    "--bg": theme.background,
    "--surface": theme.surface,
    "--text": theme.text,
    "--muted": theme.muted
  } as CSSProperties;
}

export function resolveMenuStyle(menu: MenuData): MenuStyle {
  return menu.presentation?.style === "clean" ? "clean" : "luxury";
}

export function resolveTheme(menu: MenuData): Required<MenuTheme> {
  const variant = menu.presentation?.theme?.variant ?? menu.bar.bar_type ?? "multi";
  const base = themePresets[variant];
  const configured = menu.presentation?.theme ?? {};
  const accent = normalizeHexColor(configured.accent) ?? base.accent;
  const derived = configured.accent ? paletteFromAccent(accent) : {};
  return { ...base, ...derived, ...configured, accent, variant };
}

function paletteFromAccent(accent: string): Partial<Required<MenuTheme>> {
  return {
    background: mixHex("#050506", accent, 0.025),
    surface: mixHex("#141516", accent, 0.055),
    text: "#fffaf2",
    muted: mixHex("#e8e0d5", accent, 0.18)
  };
}

function normalizeHexColor(value?: string) {
  if (!value) return null;
  const next = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(next) ? next.toLowerCase() : null;
}

function mixHex(base: string, accent: string, amount: number) {
  const left = hexToRgb(base);
  const right = hexToRgb(accent);
  if (!left || !right) return base;
  return rgbToHex({
    r: Math.round(left.r + (right.r - left.r) * amount),
    g: Math.round(left.g + (right.g - left.g) * amount),
    b: Math.round(left.b + (right.b - left.b) * amount)
  });
}

function hexToRgb(value: string) {
  const match = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(value);
  if (!match) return null;
  return {
    r: Number.parseInt(match[1], 16),
    g: Number.parseInt(match[2], 16),
    b: Number.parseInt(match[3], 16)
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}
