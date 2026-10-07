import type { Position } from "./core/model.js";
import type { TeamIssue } from "./core/team.js";
import { formatValue } from "./core/value.js";

/**
 * Alle Texte der Oberfläche. Deutsch; was auf der Karte steht, bleibt wie auf der
 * Karte (ATT, DEF, „10.0M").
 *
 * KOPFNOTIZ: keine deutschen Anführungszeichen in Zeichenketten — die schließende
 * Form ist das ASCII-Zeichen, und das beendet die Zeichenkette. Wo ein Zitat sein
 * muss, Backticks.
 */
export const S = {
  appName: "Kartenmappe",
  appSub: "Match Attax",

  nav: { collection: "Sammlung", teams: "Teams", settings: "Einstellungen" },

  positions: {
    gk: { long: "Tor", short: "TOR" },
    def: { long: "Verteidigung", short: "VER" },
    mid: { long: "Mittelfeld", short: "MIT" },
    att: { long: "Angriff", short: "ANG" },
  } satisfies Record<Position, { long: string; short: string }>,

  common: {
    back: "Zurück",
    cancel: "Abbrechen",
    done: "Fertig",
    loading: "Lädt …",
    all: "Alle",
    notFound: "Das gibt es nicht (mehr).",
    toCollection: "Zur Sammlung",
  },

  collection: {
    title: "Sammlung",
    switcher: "Welche Sammlung",
    empty: "Noch keine Karten in dieser Sammlung.",
    emptyHint: "Tippe auf + Karte, fotografiere die Karte und trage die Werte ein.",
    noMatch: "Keine Karte passt zu Filter und Suche.",
    add: "+ Karte",
    search: "Name, Verein oder Kartenart",
    allSeasons: "Alle Saisons",
    sortLabel: "Sortierung",
    sort: { neu: "Neueste", name: "Name", att: "ATT", def: "DEF", value: "Wert" },
    summary: (cards: number, pieces: number): string =>
      pieces === cards
        ? `${cards} ${cards === 1 ? "Karte" : "Karten"}`
        : `${cards} ${cards === 1 ? "Karte" : "Karten"} · ${pieces} Stück`,
    noPhoto: "kein Foto",
  },

  card: {
    newTitle: "Neue Karte",
    editTitle: "Karte",
    photo: "Foto",
    photoAdd: "Foto aufnehmen oder wählen",
    photoAddHint: "Das Gerät fragt dann: Kamera oder Fotomediathek.",
    photoRemove: "Foto entfernen",
    photoNone: "Noch kein Foto",
    photoFailed: "Das Foto konnte nicht gelesen werden.",
    photoBusy: "Foto wird verkleinert …",
    collection: "Sammlung",
    season: "Saison",
    seasonOther: "andere …",
    seasonFormat: "Saison bitte wie 25/26 schreiben — so sortiert sie richtig.",
    name: "Name",
    namePlaceholder: "Spielername",
    club: "Verein",
    position: "Position",
    att: "ATT",
    def: "DEF",
    value: "Wert",
    valueHint: "Wie auf der Karte, z. B. 10.0",
    valueBad: "Den Wert kann ich nicht lesen — bitte wie 10.0 oder 10,5.",
    goals: "Tor-Wert",
    goalsHint: "Steht klein auf der Karte, meist 1.",
    kind: "Kartenart",
    kindPlaceholder: "Basis, Limited Edition, …",
    qty: "Anzahl",
    note: "Notiz",
    serial: "Danach gleich die nächste Karte",
    serialHint: "Saison, Verein, Kartenart und Sammlung bleiben stehen.",
    save: "Speichern",
    saveNext: "Speichern · nächste Karte",
    nameMissing: "Ohne Namen geht es nicht — den brauchst du zum Suchen.",
    saved: (name: string): string => `Gespeichert: ${name}`,
    duplicate: (n: number, qty: number): string =>
      n === 1
        ? `Diese Karte hast du hier schon (${qty}×).`
        : `Diese Karte hast du hier schon ${n}-mal.`,
    duplicateAction: "Anzahl erhöhen statt neu anlegen",
    duplicateDone: (name: string, qty: number): string => `${name}: jetzt ${qty}×`,
    delete: "Karte löschen …",
    deleteWarnTeams: (teams: string[]): string =>
      teams.length === 0
        ? "Die Karte verschwindet aus dieser Sammlung. Es gibt keinen Papierkorb."
        : `Die Karte steht in ${teams.length === 1 ? "einem Team" : `${teams.length} Teams`} (${teams.join(", ")}) — dort wird der Platz frei. Es gibt keinen Papierkorb.`,
    deleteConfirm: (name: string): string => `${name} endgültig löschen`,
    deleted: (name: string): string => `${name} gelöscht`,
    writeSubject: "Die Karte",
    photoSubject: "Das Foto",
  },

  wizard: {
    title: "Neue Karte",
    steps: { foto: "Foto", name: "Name", verein: "Verein", position: "Position", werte: "Werte" },
    stepOf: (n: number, of: number): string => `Schritt ${n} von ${of}`,
    photoSkip: "Ohne Foto weiter",
    nameAsk: "Wie heißt der Spieler?",
    clubAsk: "Welcher Verein?",
    clubRecent: "Zuletzt",
    clubSkip: "Kein Verein / weiter",
    positionAsk: "Welche Position?",
    valuesAsk: "Die Werte von der Karte",
    next: "Weiter",
    back: "Zurück",
    leave: "Fertig",
    keptTitle: "Bleibt stehen",
    change: "ändern",
    keptSeasonNone: "Saison: noch keine",
    saved: (n: number): string => (n === 1 ? "1 Karte gespeichert" : `${n} Karten gespeichert`),
    saveAndNext: "Speichern · nächste Karte",
    saving: "Speichert …",
    scanHint: "Tipp: Die iPhone-Tastatur kann Text scannen — dann liest sie den Namen von der Karte ab.",
  },

  teams: {
    title: "Teams",
    empty: "Noch kein Team in dieser Sammlung.",
    emptyHint: "Ein Team sind 11 Karten: ein Torwart und zehn Feldspieler in einer echten Aufstellung.",
    add: "+ Neues Team",
    defaultName: (n: number): string => `Team ${n}`,
    name: "Name des Teams",
    formation: "Aufstellung",
    budget: "Höchstens 100.0M Mannschaftswert",
    budgetHint: "Nur eine Warnung — gesperrt wird nichts.",
    totals: { att: "ATT gesamt", def: "DEF gesamt", value: "Wert", slots: "Plätze" },
    slotsOf: (filled: number): string => `${filled} / 11`,
    emptySlot: (p: Position): string => `+ ${S.positions[p].short}`,
    pickTitle: (p: Position, slot: number): string =>
      p === "gk" ? "Torwart wählen" : `Platz ${slot}: ${S.positions[p].long}`,
    pickOnlyPosition: (p: Position): string => `Nur ${S.positions[p].long}`,
    pickAll: "Alle Positionen",
    pickSearch: "Suchen",
    pickEmpty: "Keine passende Karte in dieser Sammlung.",
    pickInTeam: (slot: number): string => (slot === 0 ? "im Tor" : `auf Platz ${slot}`),
    clearSlot: "Platz leeren",
    reslotDropped: (names: string[]): string =>
      `Beim Wechsel der Aufstellung ${names.length === 1 ? "passte" : "passten"} ${names.join(", ")} nicht mehr hinein — ${names.length === 1 ? "sie steht" : "sie stehen"} jetzt nicht mehr im Team.`,
    issuesTitle: "Hinweise",
    ok: "Alles passt: 11 Karten, Positionen stimmen.",
    delete: "Team löschen …",
    deleteConfirm: (name: string): string => `${name} endgültig löschen`,
    deleteHint: "Die Karten bleiben in der Sammlung, nur die Aufstellung ist weg.",
    deleted: (name: string): string => `${name} gelöscht`,
    writeSubject: "Das Team",
    lines: { att: "Angriff", mid: "Mittelfeld", def: "Verteidigung", gk: "Tor" },
  },

  settings: {
    title: "Einstellungen",
    collections: "Sammlungen",
    collectionsHint: "Jede Sammlung hat ihre eigenen Karten und Teams. Der Name steht in der Umschalt-Leiste.",
    collectionAdd: "+ Sammlung",
    collectionNew: (n: number): string => `Sammlung ${n}`,
    collectionSubject: "Der Name der Sammlung",
    backup: "Sicherung",
    backupHint:
      "Alles liegt nur auf diesem Gerät. Ohne Sicherung ist mit dem Gerät auch die Sammlung weg — am besten nach jeder größeren Serie einmal sichern.",
    backupWithPhotos: "Fotos mitsichern (Datei wird groß)",
    backupSave: "Sicherung speichern",
    backupLoad: "Sicherung einlesen",
    backupLast: (when: string): string => (when === "" ? "Noch nie gesichert." : `Zuletzt gesichert: ${when}`),
    backupBusy: "Sicherung wird gepackt …",
    importTitle: "Sicherung einlesen?",
    importSummary: (c: number, k: number, t: number): string =>
      `Enthält ${c} ${c === 1 ? "Sammlung" : "Sammlungen"}, ${k} ${k === 1 ? "Karte" : "Karten"} und ${t} ${t === 1 ? "Team" : "Teams"}.`,
    importHint:
      "Was es hier schon gibt (gleiche Kennung), wird durch den Stand der Sicherung ersetzt. Gelöscht wird nichts.",
    importDo: "Einlesen",
    importDone: (k: number): string => `${k} ${k === 1 ? "Karte" : "Karten"} eingelesen`,
    importBroken: "Das ist keine Sicherung dieser App.",
    importFailed: "Die Sicherung konnte nicht eingelesen werden.",
    storage: "Speicher",
    storageUsed: (mb: string): string => `${mb} MB auf diesem Gerät belegt.`,
    storageUnknown: "Wie viel Platz belegt ist, sagt dieser Browser nicht.",
    version: "Stand der App",
    versionRunning: "Auf diesem Gerät",
    versionDeployed: "Veröffentlicht",
    versionUnknown: "noch nicht nachgesehen",
    versionCurrent: "aktuell",
    versionStale: "veraltet — unten steht der Knopf",
  },

  update: {
    ready: "Neue Fassung ist da.",
    onServer: "Es gibt eine neuere Fassung.",
    apply: "Jetzt aktualisieren",
    busy: "Lädt …",
    dismiss: "Später",
    hint: "Wartet schon eine neue Fassung, wird sie übernommen. Sonst wird beim Server nachgefragt; hilft auch das nicht, wird der Zwischenspeicher geleert und neu geladen — danach ist die App erst wieder offline nutzbar, wenn sie einmal mit Netz geöffnet wurde.",
  },

  crash: {
    title: "Hier ist die App abgestürzt.",
    text: "Das ist ein Fehler in der App, nicht in deiner Bedienung. Der Text darunter hilft beim Suchen — am besten abfotografieren oder vorlesen.",
    reload: "Neu laden",
  },

  saveError: {
    retry: "Noch einmal",
    dismiss: "Ausblenden",
    quota: "Der Speicher des Geräts ist voll",
    generic: (was: string): string => `${was} konnte nicht gespeichert werden.`,
    withReason: (was: string, reason: string): string => `${reason} — ${was.toLowerCase()} wurde nicht gespeichert.`,
  },
} as const;

/** Der Satz zu einer Teamwarnung — mit den echten Namen und Zahlen. */
export function issueText(issue: TeamIssue): string {
  switch (issue.kind) {
    case "leer":
      return issue.count === 1 ? "1 Platz ist noch frei." : `${issue.count} Plätze sind noch frei.`;
    case "fehlt":
      return `Platz ${issue.slot}: die Karte wurde gelöscht — bitte neu besetzen.`;
    case "position":
      return `Platz ${issue.slot}: ${issue.cardName} ist ${S.positions[issue.actual].long}, hier gehört ${S.positions[issue.expected].long} hin.`;
    case "doppelt":
      return `${issue.cardName} steht zweimal im Team.`;
    case "budget":
      return `${formatValue(issue.overTenths)} über dem Budget von 100.0M.`;
  }
}
