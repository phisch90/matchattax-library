import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type RefObject } from "react";
import { flushSync } from "react-dom";
import { findDuplicates } from "../core/collection.js";
import { POSITIONS, type CardInput, type Position } from "../core/model.js";
import { CURRENT_SEASONS, normalizeSeason, seasonChoices } from "../core/seasons.js";
import { parseValueTenths } from "../core/value.js";
import type { CardRow } from "../db/db.js";
import { CardRepo } from "../db/repo.js";
import { useCards, useCollections, useObjectUrl } from "../lib/hooks.js";
import { shrinkPhoto, type ShrunkPhoto } from "../lib/image.js";
import { navigate } from "../lib/router.js";
import { HREF } from "../lib/routes.js";
import { guardWrite } from "../lib/saveError.js";
import { toast } from "../lib/toast.js";
import { S } from "../strings.js";
import { Btn, Chip, Field, INPUT, POSITION_TONE, Segmented } from "../ui/bits.js";

/**
 * Anlegen als Abfrage WERT FÜR WERT — sein Auftrag nach dem ersten Tag: „kein Geld
 * ausgeben … lieber Wert für Wert abfragen. Mit so wenigen Klicks wie möglich."
 *
 * Fünf Schirme: Foto → Name → Verein → Position → Werte (ATT, DEF, Wert). Was sich
 * von Karte zu Karte selten ändert (Saison, Kartenart, Tor-Wert, Sammlung), bleibt
 * stehen und ist über „ändern" erreichbar. Was sich fast immer ändert (Name,
 * Verein, Position, Werte), wird abgefragt — und zwar so, dass die Tastatur nicht
 * zugeht: Enter auf der Tastatur ist „Weiter", ein Tipp auf einen Vereins-Chip oder
 * eine Position springt von selbst.
 *
 * `flushSync` beim Schirmwechsel ist kein Zierrat: das nächste Feld muss NOCH IM
 * TIPP fokussiert werden, sonst öffnet iOS die Tastatur nicht. Erst rendern, dann
 * `focus()` — beides in derselben Berührung.
 *
 * Die Bearbeitung einer vorhandenen Karte bleibt das volle Formular
 * (`CardFormPage`); hier geht es nur ums Anlegen in Serie.
 */

type Step = "foto" | "name" | "verein" | "position" | "werte";
const STEPS: readonly Step[] = ["foto", "name", "verein", "position", "werte"];

function emptyDraft(collectionId: string, season: string): CardInput {
  return {
    collectionId,
    season,
    name: "",
    club: "",
    position: "mid",
    att: 0,
    def: 0,
    valueTenths: 0,
    goals: 1,
    kind: "",
    qty: 1,
    note: "",
  };
}

/** Die Vereine, zuletzt benutzte zuerst — als Knöpfe, weil ein Päckchen gemischt ist. */
function recentClubs(rows: readonly CardRow[] | undefined, limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of [...(rows ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
    const club = row.club.trim();
    if (club === "" || seen.has(club)) continue;
    seen.add(club);
    out.push(club);
    if (out.length >= limit) break;
  }
  return out;
}

function uniqueValues(rows: readonly CardRow[] | undefined, pick: (row: CardRow) => string): string[] {
  const set = new Set<string>();
  for (const row of rows ?? []) {
    const value = pick(row).trim();
    if (value !== "") set.add(value);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "de"));
}

export function CardWizardPage() {
  const collectionsState = useCollections();
  const current = collectionsState.current;
  const [draft, setDraft] = useState<CardInput | null>(null);
  const [step, setStep] = useState<Step>("foto");
  const [pending, setPending] = useState<ShrunkPhoto | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [valueText, setValueText] = useState("");
  const [nameMissing, setNameMissing] = useState(false);
  const [showKept, setShowKept] = useState(false);
  const [seasonCustom, setSeasonCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const clubRef = useRef<HTMLInputElement>(null);
  const attRef = useRef<HTMLInputElement>(null);
  const defRef = useRef<HTMLInputElement>(null);
  const wertRef = useRef<HTMLInputElement>(null);

  const cards = useCards(draft?.collectionId ?? current?.id);
  const clubs = useMemo(() => recentClubs(cards, 8), [cards]);
  const seasonOptions = useMemo(() => seasonChoices(uniqueValues(cards, (c) => c.season)), [cards]);
  const previewUrl = useObjectUrl(pending?.thumb);

  // Der erste Entwurf: Saison der zuletzt angelegten Karte, sonst die laufende.
  useEffect(() => {
    if (draft !== null || current === null || cards === undefined) return;
    const last = [...cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    setDraft(emptyDraft(current.id, last?.season ?? CURRENT_SEASONS[0] ?? ""));
  }, [draft, current, cards]);

  const duplicates = useMemo(
    () => (draft === null ? [] : findDuplicates(cards ?? [], draft, null)),
    [cards, draft],
  );

  if (draft === null) return <p className="text-sm text-slate-500">{S.common.loading}</p>;

  const patch = (part: Partial<CardInput>): void => setDraft((d) => (d === null ? d : { ...d, ...part }));

  /** Schirm wechseln und das nächste Feld NOCH IM TIPP fokussieren. */
  const goTo = (next: Step, focus?: RefObject<HTMLInputElement | null>): void => {
    flushSync(() => setStep(next));
    window.scrollTo(0, 0);
    focus?.current?.focus();
  };

  const onPhotoChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      setPending(await shrinkPhoto(file));
      goTo("name", nameRef);
    } catch (error) {
      console.error(error);
      setPhotoError(S.card.photoFailed);
    } finally {
      setPhotoBusy(false);
    }
  };

  const nextFromName = (): void => {
    if (draft.name.trim() === "") {
      setNameMissing(true);
      nameRef.current?.focus();
      return;
    }
    setNameMissing(false);
    goTo("verein", clubRef);
  };

  const pickClub = (club: string): void => {
    patch({ club });
    goTo("position");
  };

  const pickPosition = (position: Position): void => {
    patch({ position });
    goTo("werte", attRef);
  };

  const save = async (): Promise<void> => {
    if (saving) return;
    if (draft.name.trim() === "") {
      setNameMissing(true);
      goTo("name", nameRef);
      return;
    }
    setSaving(true);
    const input: CardInput = {
      ...draft,
      name: draft.name.trim(),
      club: draft.club.trim(),
      kind: draft.kind.trim(),
      season: normalizeSeason(draft.season) ?? draft.season.trim(),
    };
    const result = await guardWrite(() => CardRepo.create(input, pending ?? undefined), S.card.writeSubject);
    setSaving(false);
    if (!result.ok) return;
    toast(S.card.saved(input.name), HREF.karte(result.value));
    setSavedCount((n) => n + 1);
    setDraft({ ...emptyDraft(input.collectionId, input.season), kind: input.kind, goals: input.goals });
    setValueText("");
    setPending(null);
    setNameMissing(false);
    setShowKept(false);
    goTo("foto");
  };

  const bumpDuplicate = async (): Promise<void> => {
    const dup = duplicates[0];
    if (dup === undefined) return;
    const result = await guardWrite(() => CardRepo.bumpQty(dup.id, draft.qty), S.card.writeSubject);
    if (!result.ok) return;
    toast(S.card.duplicateDone(dup.name, result.value), HREF.karte(dup.id));
    setSavedCount((n) => n + 1);
    setDraft({ ...emptyDraft(draft.collectionId, draft.season), kind: draft.kind, goals: draft.goals });
    setValueText("");
    setPending(null);
    goTo("foto");
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
  const valueBad = valueText.trim() !== "" && parseValueTenths(valueText) === null;
  const collectionName = collectionsState.collections.find((c) => c.id === draft.collectionId)?.name ?? "";
  const keptLine = [
    draft.season === "" ? S.wizard.keptSeasonNone : draft.season,
    draft.kind === "" ? null : draft.kind,
    `${S.card.goals} ${draft.goals}`,
    draft.qty > 1 ? `${draft.qty}×` : null,
    collectionsState.collections.length > 1 ? collectionName : null,
  ]
    .filter((s): s is string => s !== null)
    .join(" · ");

  return (
    <div className="space-y-3" data-testid="wizard" data-step={step}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {previewUrl !== undefined && (
            <img src={previewUrl} alt="" className="h-12 w-9 shrink-0 rounded object-cover" data-testid="wizard-thumb" />
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">{S.wizard.title}</h1>
            <p className="text-xs text-slate-500">
              {S.wizard.stepOf(stepIndex + 1, STEPS.length)} · {S.wizard.steps[step]}
              {savedCount > 0 && <span className="text-emerald-300"> · {S.wizard.saved(savedCount)}</span>}
            </p>
          </div>
        </div>
        <Btn onClick={() => navigate(HREF.sammlung)}>{S.wizard.leave}</Btn>
      </div>

      {/* Der Fortschritt als fünf Striche — ein Blick sagt, wo man steht. */}
      <div className="flex gap-1" aria-hidden="true">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1 flex-1 rounded ${i <= stepIndex ? "bg-emerald-500" : "bg-slate-800"}`} />
        ))}
      </div>

      {step === "foto" && (
        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPhotoChange(e)} />
          <Btn tone="primary" className="min-h-14 w-full text-base" onClick={() => fileRef.current?.click()} disabled={photoBusy}>
            {photoBusy ? S.card.photoBusy : S.card.photoAdd}
          </Btn>
          <p className="text-center text-xs text-slate-500">{S.card.photoAddHint}</p>
          {photoError !== null && <p className="text-center text-sm text-rose-300">{photoError}</p>}
          <Btn tone="ghost" className="w-full" onClick={() => goTo("name", nameRef)} disabled={photoBusy}>
            {S.wizard.photoSkip}
          </Btn>
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
          {duplicates.length > 0 && (
            <div className="rounded-lg border border-amber-700/60 bg-amber-950/40 p-2 text-sm text-amber-100">
              <p>{S.card.duplicate(duplicates.length, duplicates[0]!.qty)}</p>
              <Btn className="mt-2" onClick={() => void bumpDuplicate()}>
                {S.card.duplicateAction}
              </Btn>
            </div>
          )}
          <p className="text-xs text-slate-500">{S.wizard.scanHint}</p>
          <div className="flex gap-2">
            <Btn onClick={() => goTo("foto")}>{S.wizard.back}</Btn>
            <Btn tone="primary" className="flex-1" onClick={nextFromName}>
              {S.wizard.next}
            </Btn>
          </div>
        </section>
      )}

      {step === "verein" && (
        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <Field label={S.wizard.clubAsk} htmlFor="karte-club">
            <input
              id="karte-club"
              ref={clubRef}
              type="text"
              value={draft.club}
              onChange={(e) => patch({ club: e.target.value })}
              onKeyDown={onEnter(() => goTo("position"))}
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="next"
              className={`${INPUT} text-xl`}
            />
          </Field>
          {clubs.length > 0 && (
            <div>
              <p className="mb-1 text-xs text-slate-500">{S.wizard.clubRecent}</p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={S.card.club}>
                {clubs.map((club) => (
                  <Chip key={club} active={draft.club === club} onClick={() => pickClub(club)}>
                    {club}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Btn onClick={() => goTo("name", nameRef)}>{S.wizard.back}</Btn>
            <Btn tone="primary" className="flex-1" onClick={() => goTo("position")}>
              {draft.club.trim() === "" ? S.wizard.clubSkip : S.wizard.next}
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
          <Btn onClick={() => goTo("verein", clubRef)}>{S.wizard.back}</Btn>
        </section>
      )}

      {step === "werte" && (
        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs font-medium text-slate-400">{S.wizard.valuesAsk}</p>
          <div className="grid grid-cols-3 gap-2">
            <Field label={S.card.att} htmlFor="karte-att">
              <input
                id="karte-att"
                ref={attRef}
                type="number"
                inputMode="numeric"
                min={0}
                value={draft.att === 0 ? "" : draft.att}
                onChange={(e) => patch({ att: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                onKeyDown={onEnter(() => defRef.current?.focus())}
                enterKeyHint="next"
                className={`${INPUT} text-center text-2xl font-semibold tabular-nums`}
              />
            </Field>
            <Field label={S.card.def} htmlFor="karte-def">
              <input
                id="karte-def"
                ref={defRef}
                type="number"
                inputMode="numeric"
                min={0}
                value={draft.def === 0 ? "" : draft.def}
                onChange={(e) => patch({ def: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                onKeyDown={onEnter(() => wertRef.current?.focus())}
                enterKeyHint="next"
                className={`${INPUT} text-center text-2xl font-semibold tabular-nums`}
              />
            </Field>
            <Field label={S.card.value} htmlFor="karte-wert" error={valueBad ? S.card.valueBad : null}>
              <div className="relative">
                <input
                  id="karte-wert"
                  ref={wertRef}
                  type="text"
                  inputMode="decimal"
                  value={valueText}
                  onChange={(e) => {
                    const text = e.target.value;
                    setValueText(text);
                    const parsed = parseValueTenths(text);
                    if (parsed !== null) patch({ valueTenths: parsed });
                    else if (text.trim() === "") patch({ valueTenths: 0 });
                  }}
                  onKeyDown={onEnter(() => void save())}
                  placeholder="10.0"
                  enterKeyHint="done"
                  className={`${INPUT} pr-7 text-center text-2xl font-semibold tabular-nums`}
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm text-slate-500">M</span>
              </div>
            </Field>
          </div>
          <div className="flex gap-2">
            <Btn onClick={() => goTo("position")}>{S.wizard.back}</Btn>
            <Btn tone="primary" className="flex-1" onClick={() => void save()} disabled={saving || photoBusy}>
              {saving ? S.wizard.saving : S.wizard.saveAndNext}
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
            <div className="grid grid-cols-2 gap-2">
              <Field label={S.card.kind} htmlFor="karte-art">
                <input
                  id="karte-art"
                  type="text"
                  value={draft.kind}
                  onChange={(e) => patch({ kind: e.target.value })}
                  placeholder={S.card.kindPlaceholder}
                  autoComplete="off"
                  className={INPUT}
                />
              </Field>
              <Field label={S.card.goals} htmlFor="karte-tor" hint={S.card.goalsHint}>
                <input
                  id="karte-tor"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={draft.goals === 0 ? "" : draft.goals}
                  onChange={(e) => patch({ goals: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                  className={INPUT}
                />
              </Field>
            </div>
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
    </div>
  );
}
