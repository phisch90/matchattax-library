import type { ReactNode } from "react";
import { HREF } from "../lib/routes.js";
import { S } from "../strings.js";
import { SaveErrorBar } from "./SaveErrorBar.js";
import { ToastHost } from "./ToastHost.js";
import { UpdateBar } from "./UpdateBar.js";

export type NavSection = "sammlung" | "teams" | "einstellungen";

const NAV: readonly { key: NavSection; href: string; label: string }[] = [
  { key: "sammlung", href: HREF.sammlung, label: S.nav.collection },
  { key: "teams", href: HREF.teams, label: S.nav.teams },
  { key: "einstellungen", href: HREF.einstellungen, label: S.nav.settings },
];

/**
 * Die Hülle: Hauptnavigation OBEN (seine Entscheidung aus Chardex35, und hier gibt es
 * keine zweite Leiste, die unten in Daumenreichweite müsste), darunter die zwei
 * Bänder für Update und fehlgeschlagenes Speichern — IM Fluss, nicht schwebend, damit
 * sie nie über einem Speichern-Knopf liegen.
 *
 * Es scrollt das FENSTER, nicht ein Kasten darin. Damit funktioniert „Zurück" mit der
 * gemerkten Höhe über `window.scrollY` (`lib/scrollMemory.ts`).
 */
export function Layout({ section, children }: { section: NavSection; children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <nav aria-label="Hauptnavigation" className="mx-auto flex max-w-3xl items-stretch">
          {NAV.map((item) => {
            const active = item.key === section;
            return (
              <a
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 flex-1 items-center justify-center border-b-2 text-sm font-medium ${
                  active
                    ? "border-emerald-500 text-emerald-300"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
      </header>
      <UpdateBar />
      <SaveErrorBar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-3">
        {children}
      </main>
      <ToastHost />
    </div>
  );
}
