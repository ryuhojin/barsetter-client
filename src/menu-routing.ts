import type { MenuData } from "./menu-types";

const LOCAL_MENU_SLUG = "__barsetter_local__";

type AndroidMenuBridge = {
  menuSlug?: () => string;
  readMenuJson?: () => string;
  notifyMenuLoaded?: (version: string) => void;
  requestMenuRefresh?: () => void;
};

declare global {
  interface Window {
    BarsetterAndroid?: AndroidMenuBridge;
  }
}

export function slugFromLocation() {
  if (isLocalMenuMode()) {
    return window.BarsetterAndroid?.menuSlug?.() || LOCAL_MENU_SLUG;
  }
  return decodeSlugToken(window.location.pathname.split("/").filter(Boolean)[0] ?? "");
}

export function isAndroidMenuApp() {
  return Boolean(window.BarsetterAndroid);
}

export function canRequestMenuRefresh() {
  return typeof window.BarsetterAndroid?.requestMenuRefresh === "function";
}

export function requestMenuRefresh() {
  if (!canRequestMenuRefresh()) return false;
  window.BarsetterAndroid?.requestMenuRefresh?.();
  return true;
}

export function decodeSlugToken(value: string) {
  const token = decodeURIComponent(value).trim();
  if (!token) return "";

  try {
    const normalized = token.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes).trim();
    if (/^[a-z0-9가-힣-]+$/i.test(decoded)) return decoded;
  } catch {
    return "";
  }

  return "";
}

export async function loadMenu(slug: string): Promise<MenuData> {
  if (slug === LOCAL_MENU_SLUG || isLocalMenuMode()) {
    const menu = parseMenuJson(await loadLocalMenuText());
    window.BarsetterAndroid?.notifyMenuLoaded?.(String(menu.version));
    return menu;
  }

  const response = await fetch(`/json/${encodeURIComponent(slug)}.json`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(response.status === 404 ? "메뉴판을 찾을 수 없습니다." : "메뉴 데이터를 불러오지 못했습니다.");
  }
  return parseMenuJson(await response.text());
}

function isLocalMenuMode() {
  return Boolean(window.BarsetterAndroid) || new URLSearchParams(window.location.search).get("source") === "local";
}

async function loadLocalMenuText() {
  const bridgeJson = window.BarsetterAndroid?.readMenuJson?.();
  if (bridgeJson?.trim()) return bridgeJson;

  const response = await fetch("/local/menu.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("저장된 로컬 메뉴판이 없습니다. 앱에서 메뉴판을 먼저 다운로드하세요.");
  }
  return response.text();
}

function parseMenuJson(raw: string): MenuData {
  try {
    return JSON.parse(raw) as MenuData;
  } catch {
    if (raw.trimStart().startsWith("<!doctype") || raw.trimStart().startsWith("<html")) {
      throw new Error("메뉴 JSON 파일을 찾을 수 없습니다. 발행 후 클라이언트 배포가 완료되었는지 확인하세요.");
    }
    throw new Error("메뉴 JSON 형식이 올바르지 않습니다.");
  }
}
