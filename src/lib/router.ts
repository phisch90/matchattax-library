import { useEffect, useMemo, useSyncExternalStore } from "react";
import { HREF, parseRoute, type Route } from "./routes.js";
import { applyPendingScroll, canGoBack } from "./scrollMemory.js";

const subscribe = (onChange: () => void): (() => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};
const snapshot = (): string => window.location.hash || "#/";

/** Die aktuelle Adresse, geparst — und nach jedem Wechsel die Scroll-Höhe. */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, snapshot, () => "#/");
  useEffect(() => applyPendingScroll(hash), [hash]);
  return useMemo(() => parseRoute(hash), [hash]);
}

export function navigate(href: string): void {
  window.location.hash = href.startsWith("#") ? href.slice(1) : href;
}

/** Einen Schritt zurück — oder zur Startseite, wenn die App frisch geöffnet wurde. */
export function goBack(fallback: string = HREF.sammlung): void {
  if (canGoBack()) history.back();
  else navigate(fallback);
}
