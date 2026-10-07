# Kartenmappe — Match Attax Sammlung

Private Web-App für die Topps-Match-Attax-Sammlung: Karten per Foto erfassen, zwei
Sammlungen (eine je Sammler), Teams in einer echten Aufstellung bauen. Alles liegt
auf dem Gerät, kein Server, offline nutzbar.

## Benutzen

Auf dem iPhone oder iPad öffnen und „Zum Home-Bildschirm" hinzufügen. Die Adresse
steht nach dem ersten Deploy im Lauf „Deploy (GitHub Pages)".

- **Sammlung**: Karten als Kacheln, Filter nach Saison und Position, Suche, Sortierung.
  „+ Karte" öffnet das Formular: Foto aufnehmen, Name, Verein, Position, ATT, DEF,
  Wert, Tor-Wert, Kartenart, Anzahl. Im Serienmodus bleibt nach dem Speichern
  stehen, was für die nächste Karte aus demselben Päckchen gleich bleibt.
- **Teams**: 11 Karten, ein Torwart, Aufstellung aus einer Liste echter Formationen.
  Summen für ATT, DEF und Wert; optional eine Warnung ab 100.0M Mannschaftswert.
  Gewarnt wird, gesperrt nie.
- **Einstellungen**: Sammlungen umbenennen, Sicherung speichern und einlesen, Stand
  der App.

## Entwickeln

```
pnpm install
pnpm dev          # Entwicklung
pnpm typecheck    # vor jedem Push
pnpm test         # Vitest, reine Logik
pnpm e2e          # baut und prüft im echten Browser (390×844, 1180×820, 820×1180)
pnpm icons        # App-Symbole neu rendern (tools/brand)
```

Stack: Vite, React, TypeScript, Tailwind 4, Dexie (IndexedDB), vite-plugin-pwa, Zod.
Die Entscheidungen hinter dem Aufbau stehen in `CLAUDE.md`.
