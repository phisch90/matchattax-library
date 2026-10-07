import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type RefObject } from "react";
import { flushSync } from "react-dom";
import { findDuplicates, nameSuggestions } from "../core/collection.js";
import { POSITIONS, type CardInput, type Position } from "../core/model.js";
import { normalizeSeason, seasonChoices } from "../core/seasons.js";
import { parseValueTenths } from "../core/value.js";
import type { CardRow } from "../db/db.js";
import { CardRepo } from "../db/repo.js";
import { useAllCards, useAppSettings, useCards, useCollections, useObjectUrl } from "../lib/hooks.js";
import { shrinkPhoto, type ShrunkPhoto } from "../lib/image.js";
import { navigate } from "../lib/router.js";
import { HREF } from "../lib/routes.js";
import { guardWrite } from "../lib/saveError.js";
import { toast } from "../lib/toast.js";
import { S } from "../strings.js";
import { Keypad } from "../ui/Keypad.js";
import { Btn, Chip, Field, INPUT, POSITION_TONE, Segmented } from "../ui/bits.js";

/**
 * Anlegen als Abfrage WERT FÜR WERT — sein Auftrag nach dem ersten Tag: „kein Geld
 * ausgeben … lieber Wert für Wert abfragen. Mit so wenigen Klicks wie möglich."
 *
 * Fünf Schirme: Foto → Nummer → Name → Position → Werte (DEF, ATT, Wert). Was sich
 * von Karte zu Karte selten ändert (Saison, Anzahl, Sammlung), bleibt stehen und ist
 * über „ändern" erreichbar.
 *
 * SAMMELUPLOAD („Ich kann in einem Rutsch mehrere Spieler-Bilder hochladen und dann
 * nacheinander abarbeiten"): das Foto-Feld nimmt mehrere Dateien. Sie stehen in einer
 * WARTESCHLANGE (`queue`), das vorderste ist die Karte, die gerade dran ist
 * (`pending`); nach dem Speichern kommt sofort das nächste Foto an die Reihe, ohne den
 * Foto-Schirm. Verkleinert wird im HINTERGRUND, eines nach dem anderen, während er
 * tippt — fünfzig iPhone-Fotos am Stück würden sonst eine Viertelminute Wartezeit
 * vor der ersten Karte kosten. Nur das Speichern wartet, falls das Foto der Karte noch
 * nicht fertig ist (`awaiting`).
 *
 * Die Zahlen werden auf einem EIGENEN Zifferblock getippt (`ui/Keypad.tsx`), nicht auf
 * der Tastatur des Geräts: das Zahlenfeld des iPhones hat keine Weiter-Taste. Die
 * Nummer springt nach der dritten Ziffer von selbst weiter („soweit ich weiss immer
 * 3 stellig"), und wenn es die Nummer in der Sammlung schon gibt, steht an dieser
 * Stelle „Anzahl erhöhen" — ein Tipp statt vier Schirme.
 *
 * Nur der Name braucht die Tastatur des Geräts. `flushSync` beim Wechsel dorthin ist
 * kein Zierrat: das Feld muss NOCH IM TIPP fokussiert werden, sonst öffnet iOS die
 * Tastatur nicht. Erst rendern, dann `focus()` — beides in derselben Berührung.
 *
 * Die Bearbeitung einer vorhandenen Karte bleibt das volle Formular
 * (`CardFormPage`); hier geht es nur ums Anlegen in Serie.
 */

type Step = "foto" | "nummer" | "name" | "position" | "werte";
const STEPS: readonly Step[] = ["foto", "nummer", "name", "position", "werte"];

/** Die drei Zahlen des letzten Schirms, in SEINER Reihenfolge: DEF vor ATT. */
type ValueKey = "def" | "att" | "wert";
const VALUE_KEYS: readonly ValueKey[] = ["def", "att", "wert"];
const NUMBER_DIGITS = 3;
/** Wie viele der wartenden Fotos als kleine Bilder gezeigt werden; der Rest ist eine Zahl. */
const STRIP_MAX = 8;

/** Ein Foto in der Warteschlange: die Datei, und sobald fertig, die verkleinerte Fassung. */
interface QueuedPhoto {
  id: number;
  file: File;
  shrunk: ShrunkPhoto | null;
  failed: boolean;
}

function emptyDraft(collectionId: string, season: string): CardInput {
  return { collectionId, season, number: "", name: "", position: "mid", att: 0, def: 0, valueTenths: 0, qty: 1, note: "" };
}

function uniqueValues(rows: readonly CardRow[] | undefined, pick: (row: CardRow) => string): string[] {
  const set = new Set<string>();
  for (const row of rows ?? []) {
    const value = pick(row).trim();
    if (value !== "") set.add(value);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "de"));
}

let nextQueueId = 1;

export function CardWizardPage() {
  const collectionsState = useCollections();
  const settings = useAppSettings();
  const current = collectionsState.current;
  const [draft, setDraft] = useState<CardInput | null>(null);
  const [zoom, setZoom] = useState(false);
  const [step, setStep] = useState<Step>("foto");
  const [active, setActive] = useState<ValueKey>("def");
  const [pending, setPending] = useState<ShrunkPhoto | null>(null);
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  /** Die Karte ist dran, aber ihr Foto ist noch nicht verkleinert — Speichern wartet. */
  const [awaiting, setAwaiting] = useState(false);
  const [leaveAsk, setLeaveAsk] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [valueText, setValueText] = useState("");
  const [nameMissing, setNameMissing] = useState(false);
  const [showKept, setShowKept] = useState(false);
  const [seasonCustom, setSeasonCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const shrinking = useRef(false);

  const cards = useCards(draft?.collectionId ?? current?.id);
  const allCards = useAllCards();
  const seasonOptions = useMemo(() => seasonChoices(uniqueValues(cards, (c) => c.season)), [cards]);
  // Das GROSSE Bild, nicht das kleine: er liest die Werte vom Foto ab, während er tippt.
  const previewUrl = useObjectUrl(pending?.full);

  // Der erste Entwurf: OHNE Saison („Wenn nichts gewählt dann leer lassen").
  useEffect(() => {
    if (draft !== null || current === null) return;
    setDraft(emptyDraft(current.id, ""));
  }, [draft, current]);

  // Im Hintergrund verkleinern: immer das vorderste Foto, das noch nicht fertig ist, eines nach dem anderen.
  useEffect(() => {
    const next = queue.find((q) => q.shrunk === null && !q.failed);
    if (next === undefined || shrinking.current) return;
    shrinking.current = true;
    shrinkPhoto(next.file, { crop: settings.autoCrop })
      .then((shrunk) => setQueue((q) => q.map((x) => (x.id === next.id ? { ...x, shrunk } : x))))
      .catch((error: unknown) => {
        console.error(error);
        setQueue((q) => q.map((x) => (x.id === next.id ? { ...x, failed: true } : x)));
      })
      .finally(() => {
        shrinking.current = false;
      });
  }, [queue, settings.autoCrop]);

  // Die Karte wartet auf ihr Foto: sobald das vorderste fertig ist, wird es ihres.
  useEffect(() => {
    if (!awaiting) return;
    const head = queue[0];
    if (head === undefined) {
      // Alle Fotos davor sind gescheitert — zurück zum Foto-Schirm, ohne stilles Weitermachen.
      setAwaiting(false);
      setStep("foto");
      return;
    }
    if (head.failed) {
      toast(S.wizard.queueFailed);
      setQueue((q) => q.slice(1));
      return;
    }
    if (head.shrunk === null) return;
    setQueue((q) => q.slice(1));
    setPending(head.shrunk);
    setAwaiting(false);
  }, [awaiting, queue]);

  const duplicates = useMemo(
    () => (draft === null ? [] : findDuplicates(cards ?? [], draft, null)),
    [cards, draft],
  );
  const suggestions = useMemo(
    () => (draft === null ? [] : nameSuggestions(allCards ?? [], draft.name, 8)),
    [allCards, draft],
  );

  if (draft === null) return <p className="text-sm text-slate-500">{S.common.loading}</p>;

  const patch = (part: Partial<CardInput>): void => setDraft((d) => (d === null ? d : { ...d, ...part }));

  /** Schirm wechseln und das nächste Feld NOCH IM TIPP fokussieren. */
  const goTo = (next: Step, focus?: RefObject<HTMLInputElement | null>): void => {
    flushSync(() => setStep(next));
    window.scrollTo(0, 0);
    focus?.current?.focus();
  };

  const onPhotoChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setPhotoError(null);
    setQueue((q) => [...q, ...files.map((file) => ({ id: nextQueueId++, file, shrunk: null, failed: false }))]);
    // Nicht warten, bis verkleinert ist: die Nummer kann er schon tippen, das Foto kommt nach.
    setAwaiting(true);
    goTo("nummer");
  };

  /** Das nächste Foto der Warteschlange wird die nächste Karte — oder, ohne eines, der Foto-Schirm. */
  const nextCard = (): void => {
    setPending(null);
    if (queue.length > 0) {
      setAwaiting(true);
      goTo("nummer");
    } else {
      setAwaiting(false);
      goTo("foto");
    }
  };

  /** Eine Ziffer der Nummer — nach der dritten geht es von selbst weiter, außer die Karte ist schon da. */
  const typeNumberDigit = (digit: string): void => {
    const next = draft.number + digit;
    patch({ number: next });
    if (next.length !== NUMBER_DIGITS || draft.number.length !== NUMBER_DIGITS - 1) return;
    const already = findDuplicates(cards ?? [], { ...draft, number: next }, null);
    if (already.length === 0) goTo("name", nameRef);
  };

  const nextFromName = (): void => {
    if (draft.name.trim() === "") {
      setNameMissing(true);
      nameRef.current?.focus();
      return;
    }
    setNameMissing(false);
    goTo("position");
  };

  const pickName = (name: string): void => {
    patch({ name });
    setNameMissing(false);
    goTo("position");
  };

  const pickPosition = (position: Position): void => {
    patch({ position });
    setActive("def");
    goTo("werte");
  };

  const typeValueDigit = (digit: string): void => {
    const d = Number(digit);
    if (active === "def") patch({ def: Math.min(999, draft.def * 10 + d) });
    else if (active === "att") patch({ att: Math.min(999, draft.att * 10 + d) });
    else setValueText((t) => (t.length >= 6 ? t : t + digit));
  };

  const typeValuePoint = (): void => {
    if (active !== "wert") return;
    setValueText((t) => (t.includes(".") || t === "" ? t : `${t}.`));
  };

  const deleteValue = (): void => {
    if (active === "def") patch({ def: Math.floor(draft.def / 10) });
    else if (active === "att") patch({ att: Math.floor(draft.att / 10) });
    else setValueText((t) => t.slice(0, -1));
  };

  const valueBad = valueText.trim() !== "" && parseValueTenths(valueText) === null;

  const afterWrite = (collectionId: string, season: string): void => {
    setSavedCount((n) => n + 1);
    setDraft(emptyDraft(collectionId, season));
    setValueText("");
    setActive("def");
    setNameMissing(false);
    setShowKept(false);
    nextCard();
  };

  const save = async (): Promise<void> => {
    if (saving || awaiting) return;
    if (draft.name.trim() === "") {
      setNameMissing(true);
      goTo("name", nameRef);
      return;
    }
    if (valueBad) return;
    setSaving(true);
    const input: CardInput = {
      ...draft,
      number: draft.number.trim(),
      name: draft.name.trim(),
      season: normalizeSeason(draft.season) ?? draft.season.trim(),
      valueTenths: parseValueTenths(valueText) ?? 0,
    };
    const result = await guardWrite(() => CardRepo.create(input, pending ?? undefined), S.card.writeSubject);
    setSaving(false);
    if (!result.ok) return;
    toast(S.card.saved(input.name), HREF.karte(result.value));
    afterWrite(input.collectionId, input.season);
  };

  const bumpDuplicate = async (): Promise<void> => {
    const dup = duplicates[0];
    if (dup === undefined) return;
    const result = await guardWrite(() => CardRepo.bumpQty(dup.id, draft.qty), S.card.writeSubject);
    if (!result.ok) return;
    toast(S.card.duplicateDone(dup.name, result.value), HREF.karte(dup.id));
    afterWrite(draft.collectionId, draft.season);
  };

  /** Das aktuelle Foto weglegen (unscharf, doppelt) und mit dem nächsten weitermachen — die Eingaben bleiben. */
  const dropPhoto = (): void => {
    if (awaiting) {
      // Das Foto, auf das gewartet wird, ist das vorderste der Schlange.
      setQueue((q) => q.slice(1));
      if (queue.length <= 1) {
        setAwaiting(false);
        goTo("foto");
      }
      return;
    }
    nextCard();
  };

  const leave = (): void => {
    const open = queue.length + (pending !== null || awaiting ? 1 : 0);
    if (open > 1 && !leaveAsk) {
      setLeaveAsk(true);
      return;
    }
    navigate(HREF.sammlung);
  };

  const nextValue = (): void => {
    if (active === "def") setActive("att");
    else if (active === "att") setActive("wert");
    else void save();
  };

  const onEnter = (handler: () => void) => (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handler();
  };

  const stepIndex = STEPS.indexOf(step);
  const seasonNorm = normalizeSeason(draft.season);
  const seasonListed = seasonNorm !== null && seasonOptions.includes(seasonNorm);
  const showSeasonInput = seasonCustom || (draft.season !== "" && !seasonListed);
  const collectionName = collectionsState.collections.find((c) => c.id === draft.collectionId)?.name ?? "";
  const keptLine = [
    draft.season === "" ? S.wizard.keptSeasonNone : draft.season,
    draft.qty > 1 ? `${draft.qty}×` : null,
    collectionsState.collections.length > 1 ? collectionName : null,
  ]
    .filter((s): s is string => s !== null)
    .join(" · ");
  const dup = duplicates[0];
  const hasPhoto = pending !== null || awaiting;
  const openPhotos = queue.length + (hasPhoto ? 1 : 0);

  const duplicateBox = dup === undefined ? null : (
    <div className="rounded-lg border border-amber-700/60 bg-amber-950/40 p-2 text-sm text-amber-100" data-testid="duplicate">
      <p>{S.card.duplicate(dup.name, dup.qty)}</p>
      <Btn className="mt-2" onClick={() => void bumpDuplicate()}>
        {S.card.duplicateAction}
      </Btn>
    </div>
  );

  const valueDisplay = (key: ValueKey): string => {
    if (key === "def") return draft.def === 0 ? "" : String(draft.def);
    if (key === "att") return draft.att === 0 ? "" : String(draft.att);
    return valueText;
  };
  const VALUE_LABEL: Record<ValueKey, { short: string; long: string }> = {
    def: { short: S.card.def, long: S.card.defLong },
    att: { short: S.card.att, long: S.card.attLong },
    wert: { short: S.card.value, long: S.card.valueHint },
  };

  return (
    <div className="space-y-3" data-testid="wizard" data-step={step} data-queue={queue.length} data-awaiting={awaiting ? "1" : "0"}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">{S.wizard.title}</h1>
          <p className="text-xs text-slate-500">
            {S.wizard.stepOf(stepIndex + 1, STEPS.length)} · {S.wizard.steps[step]}
            {savedCount > 0 && <span className="text-emerald-300"> · {S.wizard.saved(savedCount)}</span>}
          </p>
        </div>
        <Btn onClick={leave}>{S.wizard.leave}</Btn>
      </div>

      {/* Der Fortschritt als fünf Striche — ein Blick sagt, wo man steht. */}
      <div className="flex gap-1" aria-hidden="true">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1 flex-1 rounded ${i <= stepIndex ? "bg-emerald-500" : "bg-slate-800"}`} />
        ))}
      </div>

      {leaveAsk && openPhotos > 1 && (
        <div className="rounded-lg border border-amber-700/60 bg-amber-950/40 p-3 text-sm text-amber-100" data-testid="leave-ask">
          <p>{S.wizard.leaveAsk(openPhotos)}</p>
          <div className="mt-2 flex gap-2">
            <Btn tone="primary" onClick={() => setLeaveAsk(false)}>
              {S.wizard.leaveStay}
            </Btn>
            <Btn onClick={() => navigate(HREF.sammlung)}>{S.wizard.leaveAnyway}</Btn>
          </div>
        </div>
      )}

      {/*
        Das Foto der Karte, die dran ist, GROSS — „bei der Sammelbearbeitung sollten die
        Bilder größer sein, da man die so kaum erkennt". Er liest Nummer und Werte vom
        Foto ab; ein Tipp darauf zeigt es bildschirmfüllend. Daneben, was noch wartet.
      */}
      {((step !== "foto" && hasPhoto) || queue.length > 0) && (
        <div className="flex gap-3" data-testid="photo-panel">
          {step !== "foto" && hasPhoto && (
            <button
              type="button"
              onClick={() => previewUrl !== undefined && setZoom(true)}
              aria-label={S.wizard.photoZoom}
              data-testid="photo-big"
              className="shrink-0 overflow-hidden rounded-lg bg-slate-800"
            >
              {previewUrl !== undefined ? (
                <img src={previewUrl} alt="" className="h-44 w-[7.9rem] object-cover" data-testid="wizard-thumb" />
              ) : (
                <div className="h-44 w-[7.9rem] animate-pulse" aria-hidden="true" />
              )}
            </button>
          )}
          {queue.length > 0 && (
            <div className="min-w-0 flex-1" data-testid="queue">
              <p className="mb-1 text-xs tabular-nums text-slate-400" data-testid="queue-count">
                {S.wizard.queueWaiting(queue.length)}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {queue.slice(0, STRIP_MAX).map((q) => (
                  <QueueThumb key={q.id} photo={q.shrunk} />
                ))}
                {queue.length > STRIP_MAX && (
                  <span className="self-center text-xs tabular-nums text-slate-400">{S.wizard.queueMore(queue.length - STRIP_MAX)}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {step === "foto" && (
        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPhotoChange} />
          <Btn tone="primary" className="min-h-14 w-full text-base" onClick={() => fileRef.current?.click()}>
            {S.card.photoAdd}
          </Btn>
          <p className="text-center text-xs text-slate-500">{S.card.photoAddHint}</p>
          {photoError !== null && <p className="text-center text-sm text-rose-300">{photoError}</p>}
          <Btn tone="ghost" className="w-full" onClick={() => goTo("nummer")}>
            {S.wizard.photoSkip}
          </Btn>
        </section>
      )}

      {step === "nummer" && (
        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs font-medium text-slate-400">{S.wizard.numberAsk}</p>
          <div
            className="min-h-14 rounded-lg border border-emerald-500 bg-slate-950 px-3 py-2 text-center text-3xl font-semibold tabular-nums tracking-[0.3em]"
            data-testid="val-nummer"
            aria-label={S.card.number}
          >
            {draft.number === "" ? <span className="text-slate-700">···</span> : draft.number}
          </div>
          <p className="text-xs text-slate-500">{S.wizard.numberHint}</p>
          {duplicateBox}
          <Keypad onDigit={typeNumberDigit} onDelete={() => patch({ number: draft.number.slice(0, -1) })} decimal={false} />
          <div className="flex gap-2">
            <Btn onClick={() => goTo("foto")}>{S.wizard.back}</Btn>
            <Btn tone="primary" className="flex-1" onClick={() => goTo("name", nameRef)}>
              {dup !== undefined ? S.wizard.numberAnyway : draft.number === "" ? S.wizard.numberSkip : S.wizard.next}
            </Btn>
          </div>
          {hasPhoto && (
            <Btn tone="ghost" className="w-full text-xs" onClick={dropPhoto}>
              {S.wizard.photoDrop}
            </Btn>
          )}
        </section>
      )}

      {step === "name" && (
        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <Field label={S.wizard.nameAsk} htmlFor="karte-name" error={nameMissing ? S.card.nameMissing : null}>
            <input
              id="karte-name"
              ref={nameRef}
              type="text"
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              onKeyDown={onEnter(nextFromName)}
              placeholder={S.card.namePlaceholder}
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="next"
              className={`${INPUT} text-xl`}
            />
          </Field>
          {suggestions.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-slate-500">{S.wizard.nameKnown}</p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={S.card.name}>
                {suggestions.map((name) => (
                  <Chip key={name} active={draft.name === name} onClick={() => pickName(name)}>
                    {name}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          {draft.number === "" && duplicateBox}
          <p className="text-xs text-slate-500">{S.wizard.scanHint}</p>
          <div className="flex gap-2">
            <Btn onClick={() => goTo("nummer")}>{S.wizard.back}</Btn>
            <Btn tone="primary" className="flex-1" onClick={nextFromName}>
              {S.wizard.next}
            </Btn>
          </div>
        </section>
      )}

      {step === "position" && (
        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs font-medium text-slate-400">{S.wizard.positionAsk}</p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label={S.card.position}>
            {POSITIONS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => pickPosition(p)}
                className={`min-h-20 rounded-xl border border-transparent text-lg font-semibold ${POSITION_TONE[p]}`}
              >
                <span className="block text-2xl">{S.positions[p].short}</span>
                <span className="block text-xs font-normal opacity-80">{S.positions[p].long}</span>
              </button>
            ))}
          </div>
          <Btn onClick={() => goTo("name", nameRef)}>{S.wizard.back}</Btn>
        </section>
      )}

      {step === "werte" && (
        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs font-medium text-slate-400">{S.wizard.valuesAsk}</p>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label={S.wizard.valuesGroup}>
            {VALUE_KEYS.map((key) => {
              const isActive = active === key;
              const text = valueDisplay(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActive(key)}
                  aria-pressed={isActive}
                  data-testid={`val-${key}`}
                  className={`rounded-lg border px-1 py-2 text-center ${
                    isActive ? "border-emerald-500 bg-slate-950" : "border-slate-700 bg-slate-900"
                  }`}
                >
                  <span className="block text-xs font-medium text-slate-400">{VALUE_LABEL[key].short}</span>
                  <span className="block min-h-9 text-2xl font-semibold tabular-nums" data-testid={`val-${key}-text`}>
                    {text === "" ? <span className="text-slate-700">–</span> : text}
                    {key === "wert" && text !== "" && <span className="text-sm text-slate-500">M</span>}
                  </span>
                  <span className="block text-[10px] leading-tight text-slate-500">{VALUE_LABEL[key].long}</span>
                </button>
              );
            })}
          </div>
          {valueBad && <p className="text-xs text-rose-300">{S.card.valueBad}</p>}
          <Keypad onDigit={typeValueDigit} onPoint={typeValuePoint} onDelete={deleteValue} decimal={active === "wert"} />
          <div className="flex gap-2">
            <Btn onClick={() => goTo("position")}>{S.wizard.back}</Btn>
            <Btn tone="primary" className="flex-1" onClick={nextValue} disabled={saving || (active === "wert" && awaiting)}>
              {saving ? S.wizard.saving : active !== "wert" ? S.wizard.next : awaiting ? S.wizard.queueBusy : S.wizard.saveAndNext}
            </Btn>
          </div>
        </section>
      )}

      {/* Was stehen bleibt — ein Blick, und bei Bedarf ein Tipp auf „ändern". */}
      <section className="rounded-xl border border-slate-800 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-xs text-slate-400" data-testid="kept-line">
            <span className="font-semibold uppercase tracking-wider text-slate-500">{S.wizard.keptTitle}: </span>
            {keptLine}
          </p>
          <button
            type="button"
            onClick={() => setShowKept((v) => !v)}
            aria-expanded={showKept}
            className="shrink-0 text-sm text-emerald-300 underline-offset-2 hover:underline"
          >
            {S.wizard.change}
          </button>
        </div>
        {showKept && (
          <div className="mt-3 space-y-3">
            {collectionsState.collections.length > 1 && (
              <Field label={S.card.collection}>
                <Segmented
                  label={S.card.collection}
                  options={collectionsState.collections.map((c) => ({ value: c.id, label: c.name }))}
                  value={draft.collectionId}
                  onChange={(collectionId) => patch({ collectionId })}
                />
              </Field>
            )}
            <Field label={S.card.season} error={draft.season !== "" && seasonNorm === null ? S.card.seasonFormat : null}>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={S.card.season}>
                <Chip
                  active={draft.season === "" && !showSeasonInput}
                  onClick={() => {
                    setSeasonCustom(false);
                    patch({ season: "" });
                  }}
                >
                  {S.card.seasonNone}
                </Chip>
                {seasonOptions.map((s) => (
                  <Chip
                    key={s}
                    active={seasonNorm === s}
                    onClick={() => {
                      setSeasonCustom(false);
                      patch({ season: s });
                    }}
                  >
                    {s}
                  </Chip>
                ))}
                <Chip active={showSeasonInput} onClick={() => setSeasonCustom(true)}>
                  {S.card.seasonOther}
                </Chip>
              </div>
              {showSeasonInput && (
                <input
                  type="text"
                  inputMode="numeric"
                  value={draft.season}
                  onChange={(e) => patch({ season: e.target.value })}
                  onBlur={() => {
                    const norm = normalizeSeason(draft.season);
                    if (norm !== null && norm !== draft.season) patch({ season: norm });
                  }}
                  placeholder="24/25"
                  aria-label={S.card.season}
                  className={`${INPUT} mt-2`}
                />
              )}
            </Field>
            <Field label={S.card.qty}>
              <div className="flex items-center gap-1">
                <Btn aria-label="eine weniger" onClick={() => patch({ qty: Math.max(1, draft.qty - 1) })} className="w-11 px-0">
                  −
                </Btn>
                <span className="w-10 text-center text-xl font-semibold tabular-nums" data-testid="qty">
                  {draft.qty}
                </span>
                <Btn aria-label="eine mehr" onClick={() => patch({ qty: draft.qty + 1 })} className="w-11 px-0">
                  +
                </Btn>
              </div>
            </Field>
          </div>
        )}
      </section>

      {zoom && previewUrl !== undefined && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3"
          role="dialog"
          aria-modal="true"
          aria-label={S.wizard.photoZoom}
          onClick={() => setZoom(false)}
          data-testid="photo-zoom"
        >
          <img src={previewUrl} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
          <button
            type="button"
            onClick={() => setZoom(false)}
            aria-label={S.common.close}
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/80 text-lg text-slate-100"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

/** Ein wartendes Foto, klein — oder ein leerer Kasten, solange es noch verkleinert wird. */
function QueueThumb({ photo }: { photo: ShrunkPhoto | null }) {
  const url = useObjectUrl(photo?.thumb);
  return url === undefined ? (
    <div className="h-16 w-[2.9rem] animate-pulse rounded bg-slate-800" aria-hidden="true" />
  ) : (
    <img src={url} alt="" className="h-16 w-[2.9rem] rounded object-cover" data-testid="queue-thumb" />
  );
}
