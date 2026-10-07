import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { findDuplicates } from "../core/collection.js";
import { POSITIONS, type CardInput, type Position } from "../core/model.js";
import { normalizeSeason, seasonChoices } from "../core/seasons.js";
import { parseValueTenths, valueInputText } from "../core/value.js";
import { db, type CardRow, type PhotoRow } from "../db/db.js";
import { CardRepo, SettingsRepo, hydrateCard, hydrateTeam } from "../db/repo.js";
import { useAppSettings, useCards, useCollections, useMirror, useObjectUrl } from "../lib/hooks.js";
import { shrinkPhoto, type ShrunkPhoto } from "../lib/image.js";
import { goBack } from "../lib/router.js";
import { HREF } from "../lib/routes.js";
import { guardWrite } from "../lib/saveError.js";
import { toast } from "../lib/toast.js";
import { S } from "../strings.js";
import { Box, Btn, Chip, DangerZone, Empty, Field, INPUT, POSITION_TONE, Segmented } from "../ui/bits.js";

/**
 * EIN Formular für Anlegen und Bearbeiten. Zwei Betriebsarten, und der Unterschied
 * ist das Speichern:
 *
 * - NEU: ein Entwurf im Speicher, geschrieben beim Tipp auf „Speichern". Danach im
 *   Serienmodus gleich die nächste Karte — Saison, Verein, Kartenart und Sammlung
 *   bleiben stehen, denn ein Stapel Karten kommt aus demselben Päckchen.
 * - BEARBEITEN: jede Änderung wird SOFORT geschrieben (durchschreiben, nicht
 *   zwischenspeichern — eine Kopie, die erst beim Verlassen speichert, verliert
 *   Tippen). „Fertig" geht nur zurück.
 *
 * Alle Hooks stehen VOR dem ersten `return` — ein Hook hinter einer Bedingung ist
 * kein Hook (React-Fehler 310, die halbe Seite weiß).
 */

function emptyDraft(collectionId: string): CardInput {
  return {
    collectionId,
    season: "",
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

function rowToInput(row: CardRow): CardInput {
  const { id: _id, createdAt: _c, updatedAt: _u, hasPhoto: _h, thumb: _t, ...input } = row;
  return input;
}

export function CardFormPage({ id: cardId }: { id: string | null }) {
  const isNew = cardId === null;
  const collectionsState = useCollections();
  const settings = useAppSettings();
  const [serial, setSerial] = useMirror(settings.serialMode);

  // `null` heißt „gibt es nicht", `undefined` heißt „lädt noch" — ohne diese Trennung
  // zeigte die Seite bei einer gelöschten Karte ewig „Lädt …".
  const existing = useLiveQuery<CardRow | null | undefined>(
    () => (cardId === null ? Promise.resolve(undefined) : db.cards.get(cardId).then((r) => r ?? null)),
    [cardId],
  );
  const photoRow = useLiveQuery<PhotoRow | undefined>(
    () => (cardId === null ? Promise.resolve(undefined) : db.photos.get(cardId)),
    [cardId],
  );
  const teamsAll = useLiveQuery(() => db.teams.toArray(), []);

  const [draft, setDraft] = useState<CardInput | null>(null);
  const [valueText, setValueText] = useState("");
  const [positionChosen, setPositionChosen] = useState(!isNew);
  const [seasonCustom, setSeasonCustom] = useState(false);
  const [pending, setPending] = useState<ShrunkPhoto | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [triedSave, setTriedSave] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (draft !== null) return;
    if (cardId === null) {
      if (collectionsState.current !== null) setDraft(emptyDraft(collectionsState.current.id));
      return;
    }
    if (existing !== null && existing !== undefined) {
      const row = hydrateCard(existing);
      setDraft(rowToInput(row));
      setValueText(row.valueTenths === 0 ? "" : valueInputText(row.valueTenths));
    }
  }, [draft, cardId, collectionsState.current, existing]);

  const sameCollection = useCards(draft?.collectionId);
  /*
    Die Vorschläge (Verein, Kartenart, Saison) kommen aus den Karten, die für den
    Doppelt-Hinweis ohnehin geladen sind — NICHT über `uniqueKeys()` am Index. Das war
    der Weg, der auf seinem iPhone „UnknownError: Unable to open cursor" warf: Safari
    kann diesen Zugriff auf einen Index nicht, Chromium schon. Die Startseite liest
    anders und lief deshalb.
  */
  const clubs = useMemo(() => uniqueValues(sameCollection, (c) => c.club), [sameCollection]);
  const kinds = useMemo(() => uniqueValues(sameCollection, (c) => c.kind), [sameCollection]);
  const seasonOptions = useMemo(
    () => seasonChoices(uniqueValues(sameCollection, (c) => c.season)),
    [sameCollection],
  );
  const duplicates = useMemo(
    () => (draft === null ? [] : findDuplicates(sameCollection ?? [], draft, cardId)),
    [sameCollection, draft, cardId],
  );
  const teamsUsing = useMemo(
    () =>
      cardId === null
        ? []
        : (teamsAll ?? []).map(hydrateTeam).filter((t) => t.slots.includes(cardId)),
    [teamsAll, cardId],
  );

  const previewBlob = cardId === null ? pending?.full : photoRow?.full;
  const previewUrl = useObjectUrl(previewBlob);

  if (cardId !== null && existing === null) {
    return (
      <Empty title={S.common.notFound}>
        <a href={HREF.sammlung} className="text-emerald-300 underline">
          {S.common.toCollection}
        </a>
      </Empty>
    );
  }
  if (draft === null) return <p className="text-sm text-slate-500">{S.common.loading}</p>;

  const patch = (part: Partial<CardInput>): void => {
    setDraft((d) => (d === null ? d : { ...d, ...part }));
    if (cardId !== null) void guardWrite(() => CardRepo.update(cardId, part), S.card.writeSubject);
  };

  const onPhotoChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const shrunk = await shrinkPhoto(file);
      if (cardId === null) setPending(shrunk);
      else await guardWrite(() => CardRepo.setPhoto(cardId, shrunk), S.card.photoSubject);
    } catch (error) {
      console.error(error);
      setPhotoError(S.card.photoFailed);
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = (): void => {
    if (cardId === null) setPending(null);
    else void guardWrite(() => CardRepo.removePhoto(cardId), S.card.photoSubject);
  };

  const resetForNext = (keep: CardInput): void => {
    setDraft({ ...emptyDraft(keep.collectionId), season: keep.season, club: keep.club, kind: keep.kind });
    setValueText("");
    setPending(null);
    setPositionChosen(false);
    setTriedSave(false);
    setSeasonCustom(false);
    window.scrollTo({ top: 0 });
  };

  const nameMissing = draft.name.trim() === "";
  const save = async (): Promise<void> => {
    if (nameMissing || !positionChosen) {
      setTriedSave(true);
      if (nameMissing) nameRef.current?.focus();
      return;
    }
    const input: CardInput = {
      ...draft,
      name: draft.name.trim(),
      club: draft.club.trim(),
      kind: draft.kind.trim(),
      season: normalizeSeason(draft.season) ?? draft.season.trim(),
    };
    const result = await guardWrite(() => CardRepo.create(input, pending ?? undefined), S.card.writeSubject);
    if (!result.ok) return;
    toast(S.card.saved(input.name), HREF.karte(result.value));
    if (serial) resetForNext(input);
    else goBack();
  };

  const bumpDuplicate = async (): Promise<void> => {
    const dup = duplicates[0];
    if (dup === undefined) return;
    const result = await guardWrite(() => CardRepo.bumpQty(dup.id, draft.qty), S.card.writeSubject);
    if (!result.ok) return;
    toast(S.card.duplicateDone(dup.name, result.value), HREF.karte(dup.id));
    if (serial) resetForNext(draft);
    else goBack();
  };

  const seasonNorm = normalizeSeason(draft.season);
  const seasonListed = seasonNorm !== null && seasonOptions.includes(seasonNorm);
  const showSeasonInput = seasonCustom || (draft.season !== "" && !seasonListed);
  const valueBad = valueText.trim() !== "" && parseValueTenths(valueText) === null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">{isNew ? S.card.newTitle : S.card.editTitle}</h1>
        {!isNew && (
          <Btn tone="primary" onClick={() => goBack()}>
            {S.common.done}
          </Btn>
        )}
      </div>

      <Box title={S.card.photo}>
        <div className="flex gap-3">
          <div className="aspect-[63/88] w-28 shrink-0 overflow-hidden rounded-lg bg-slate-800 sm:w-36">
            {previewUrl !== undefined ? (
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center p-2 text-center text-xs text-slate-500">
                {S.card.photoNone}
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {/*
              BEWUSST ohne `capture`: damit öffnet das iPhone die Kamera nicht direkt, sondern
              fragt „Fotomediathek / Foto aufnehmen". Der direkte Weg zeigte in der
              installierten Web-App einen schwarzen Sucher ohne Nachfrage — sein erster
              Befund am echten Gerät. Ein Tipp mehr ist besser als ein schwarzer Bildschirm.
            */}
            <input ref={pickRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPhotoChange(e)} />
            <Btn tone="primary" onClick={() => pickRef.current?.click()} disabled={photoBusy}>
              {S.card.photoAdd}
            </Btn>
            <p className="text-xs text-slate-500">{S.card.photoAddHint}</p>
            {previewUrl !== undefined && (
              <Btn tone="ghost" onClick={removePhoto} disabled={photoBusy}>
                {S.card.photoRemove}
              </Btn>
            )}
            {photoBusy && <p className="text-xs text-slate-400">{S.card.photoBusy}</p>}
            {photoError !== null && <p className="text-xs text-rose-300">{photoError}</p>}
          </div>
        </div>
      </Box>

      <Box>
        <div className="space-y-3">
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

          <Field label={S.card.name} htmlFor="karte-name" error={triedSave && nameMissing ? S.card.nameMissing : null}>
            <input
              id="karte-name"
              ref={nameRef}
              type="text"
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder={S.card.namePlaceholder}
              autoComplete="off"
              className={INPUT}
            />
          </Field>

          {isNew && duplicates.length > 0 && (
            <div className="rounded-lg border border-amber-700/60 bg-amber-950/40 p-2 text-sm text-amber-100">
              <p>{S.card.duplicate(duplicates.length, duplicates[0]!.qty)}</p>
              <Btn className="mt-2" onClick={() => void bumpDuplicate()}>
                {S.card.duplicateAction}
              </Btn>
            </div>
          )}

          <Field label={S.card.club} htmlFor="karte-club">
            <input
              id="karte-club"
              type="text"
              list="karte-clubs"
              value={draft.club}
              onChange={(e) => patch({ club: e.target.value })}
              autoComplete="off"
              className={INPUT}
            />
            <datalist id="karte-clubs">
              {clubs.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>

          <Field label={S.card.position} error={triedSave && !positionChosen ? "Bitte die Position wählen." : null}>
            <div className="grid grid-cols-4 gap-1.5" role="group" aria-label={S.card.position}>
              {POSITIONS.map((p: Position) => {
                const active = positionChosen && draft.position === p;
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setPositionChosen(true);
                      patch({ position: p });
                    }}
                    className={`min-h-12 rounded-lg border text-sm font-semibold ${
                      active
                        ? `${POSITION_TONE[p]} border-transparent`
                        : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <span className="block text-base">{S.positions[p].short}</span>
                    <span className="block text-[10px] font-normal opacity-80">{S.positions[p].long}</span>
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <NumField id="karte-att" label={S.card.att} value={draft.att} onChange={(att) => patch({ att })} big />
            <NumField id="karte-def" label={S.card.def} value={draft.def} onChange={(def) => patch({ def })} big />
            <Field label={S.card.value} htmlFor="karte-wert" error={valueBad ? S.card.valueBad : null}>
              <div className="relative">
                <input
                  id="karte-wert"
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
                  placeholder="10.0"
                  className={`${INPUT} pr-7 text-center text-2xl font-semibold tabular-nums`}
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm text-slate-500">M</span>
              </div>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <NumField
              id="karte-tor"
              label={S.card.goals}
              value={draft.goals}
              onChange={(goals) => patch({ goals })}
              hint={S.card.goalsHint}
            />
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

          <Field label={S.card.kind} htmlFor="karte-art">
            <input
              id="karte-art"
              type="text"
              list="karte-arten"
              value={draft.kind}
              onChange={(e) => patch({ kind: e.target.value })}
              placeholder={S.card.kindPlaceholder}
              autoComplete="off"
              className={INPUT}
            />
            <datalist id="karte-arten">
              {kinds.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </Field>

          <Field label={S.card.note} htmlFor="karte-notiz">
            <textarea
              id="karte-notiz"
              value={draft.note}
              onChange={(e) => patch({ note: e.target.value })}
              rows={2}
              className={`${INPUT} min-h-0`}
            />
          </Field>
        </div>
      </Box>

      {isNew && (
        <label className="flex items-start gap-2 rounded-xl border border-slate-800 p-3 text-sm">
          <input
            type="checkbox"
            checked={serial}
            onChange={(e) => {
              setSerial(e.target.checked);
              void guardWrite(() => SettingsRepo.patch({ serialMode: e.target.checked }), "Der Serienmodus");
            }}
            className="mt-0.5 h-5 w-5 accent-emerald-500"
          />
          <span>
            {S.card.serial}
            <span className="block text-xs text-slate-500">{S.card.serialHint}</span>
          </span>
        </label>
      )}

      {!isNew && cardId !== null && (
        <DangerZone
          label={S.card.delete}
          hint={S.card.deleteWarnTeams(teamsUsing.map((t) => t.name))}
          confirmLabel={S.card.deleteConfirm(draft.name === "" ? "Karte" : draft.name)}
          onConfirm={() => {
            const name = draft.name;
            void guardWrite(() => CardRepo.remove(cardId), S.card.writeSubject).then((result) => {
              if (!result.ok) return;
              toast(S.card.deleted(name === "" ? "Karte" : name));
              goBack();
            });
          }}
        />
      )}

      {isNew && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800 bg-slate-950/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl gap-2">
            <Btn onClick={() => goBack()}>{S.common.cancel}</Btn>
            <Btn tone="primary" className="flex-1" onClick={() => void save()} disabled={photoBusy}>
              {serial ? S.card.saveNext : S.card.save}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Ein Zahlenfeld, das bei 0 LEER ist: sonst stünde eine 0 im Feld, die er erst löschen
 * müsste, bevor er tippt — bei dreihundert Karten ist das ein Griff zu viel je Wert.
 */
function NumField({
  id,
  label,
  value,
  onChange,
  hint,
  big = false,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string | undefined;
  big?: boolean;
}) {
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        value={value === 0 ? "" : value}
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        className={`${INPUT} ${big ? "text-center text-2xl font-semibold tabular-nums" : ""}`}
      />
    </Field>
  );
}

/** Die verschiedenen Werte eines Feldes, alphabetisch, Leeres weggelassen. */
function uniqueValues(rows: readonly CardRow[] | undefined, pick: (row: CardRow) => string): string[] {
  const set = new Set<string>();
  for (const row of rows ?? []) {
    const value = pick(row).trim();
    if (value !== "") set.add(value);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "de"));
}
