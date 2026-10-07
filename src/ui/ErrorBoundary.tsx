import { Component, type ErrorInfo, type ReactNode } from "react";
import { HREF } from "../lib/routes.js";
import { S } from "../strings.js";

/**
 * Der Auffangrahmen. Ohne ihn räumt React bei einem Fehler im Aufbau einer Seite den
 * GANZEN Baum ab — auf einer dunklen App ist das ein schwarzer Bildschirm, und auf
 * dem iPhone schaut niemand in die Konsole. Sein Befund war wörtlich: „kommt ein
 * schwarzer Bildschirm."
 *
 * Hier steht stattdessen der Fehler in seinen Worten, dazu der technische Text zum
 * Vorlesen und zwei Wege heraus. Der Rahmen sitzt UM die Seite und IN der Hülle, damit
 * die Hauptnavigation oben bedienbar bleibt. Mit dem Schlüssel der Adresse (siehe
 * `App.tsx`) setzt er sich beim nächsten Seitenwechsel von selbst zurück.
 */
interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;
    return (
      <div role="alert" className="rounded-xl border border-rose-800 bg-rose-950/60 p-4">
        <p className="text-base font-semibold text-rose-100">{S.crash.title}</p>
        <p className="mt-1 text-sm text-rose-200">{S.crash.text}</p>
        <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-2 text-[11px] leading-snug text-slate-300">
          {error.name}: {error.message}
          {error.stack !== undefined && error.stack !== "" ? `\n\n${error.stack}` : ""}
        </pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={HREF.sammlung}
            onClick={() => this.setState({ error: null })}
            className="min-h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium"
          >
            {S.common.toCollection}
          </a>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium"
          >
            {S.crash.reload}
          </button>
        </div>
      </div>
    );
  }
}
