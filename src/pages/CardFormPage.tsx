import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { POSITIONS, type CardInput, type Position } from "../core/model.js";
import { normalizeSeason, seasonChoices } from "../core/seasons.js";
import { parseValueTenths, valueInputText } from "../core/value.js";
import { db, type CardRow, type PhotoRow } from "../db/db.js";
import { CardRepo, hydrateCard, hydrateTeam } from "../db/repo.js";
import { useCards, useCollections, useObjectUrl } from "../lib/hooks.js";
import { shrinkPhoto } from "../lib/image.js";
import { goBack } from "../lib/router.js";
import { HREF } from "../lib/routes.js";
import { guardWrite } from "../lib/saveError.js";
import { toast } from "../lib/toast.js";
import { S } from "../strings.js";
import { Box, Btn, Chip, DangerZone, Empty, Field, INPUT, POSITION_TONE, Segmented } from "../ui/bits.js";

/**
 * Das Formular zum BEARBEITEN einer Karte. Jede Änderung wird SOFORT geschrieben
 * (durchschreiben, nicht zwischenspeichern — eine Kopie, die erst beim Verlassen
 * speichert, verliert Tippen). „Fertig" geht nur zurück.
 *
 * Angelegt wird nicht hier, sondern Wert für Wert im Assistenten
 * (`CardWizardPage`). Der Anlege-Zweig, den dieses Formular einmal hatte
 * (Entwurf, Serienmodus, Speichern-Leiste), ist weg — seit dem Assistenten war er
 * nicht mehr erreichbar, und Code, den niemand erreicht, ist Code, den niemand prüft.
 *
 * Alle Hooks stehen VOR dem ersten `return` — ein Hook hinter einer Bedingung ist
 * kein Hook (React-Fehler 310, die halbe Seite weiß).
 */

function rowToInput(row: CardRow): CardInput {
  const { id: _id, createdAt: _c, updatedAt: _u, hasPhoto: _h, thumb: _t, ...input } = row;
  return input;
}

export function CardFormPage({ id: cardId }: { id: string }) {
  const collectionsState = useCollections();

  // `null` heißt „gibt es nicht", `undefined` heißt „lädt noch" — ohne diese Trennung
  // zeigte die Seite bei einer gelöschten Karte ewig „Lädt …".
  const existing = useLiveQuery<CardRow | null | undefined>(
    () => db.cards.get(cardId).then((r) => r ?? null),
    [cardId],
  );
  const photoRow = useLiveQuery<PhotoRow | undefined>(() => db.photos.get(cardId), [cardId]);
  const teamsAll = useLiveQuery(() => db.teams.toArray(), []);

  const [draft, setDraft] = useState<CardInput | null>(null);
  const [valueText, setValueText] = useState("");
  const [seasonCustom, setSeasonCustom] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const pickRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (draft !== null || existing === null || existing === undefined) return;
    const row = hydrateCard(existing);
    setDraft(rowToInput(row));
    setValueText(row.valueTenths === 0 ? "" : valueInputText(row.valueTenths));
  }, [draft, existing]);

  const sameCollection = useCards(draft?.collectionId);
  /*
    Die Saison-Vorschläge kommen aus den geladenen Karten der Sammlung — NICHT über
    `uniqueKeys()` am Index. Das war der Weg, der auf seinem iPhone „UnknownError:
    Unable to open cursor" warf: Safari kann diesen Zugriff auf einen Index nicht.
  */
  const seasonOptions = useMemo(
    () => seasonChoices((sameCollection ?? []).map((c) => c.season)),
    [sameCollection],
  );
  const teamsUsing = useMemo(
    () => (teamsAll ?? []).map(hydrateTeam).filter((t) => t.slots.includes(cardId)),
    [teamsAll, cardId],
  );
  const previewUrl = useObjectUrl(photoRow?.full);

  if (existing === null) {
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
    void guardWrite(() => CardRepo.update(cardId, part), S.card.writeSubject);
  };

  const onPhotoChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const shrunk = await shrinkPhoto(file);
      await guardWrite(() => CardRepo.setPhoto(cardId, shrunk), S.card.photoSubject);
    } catch (error) {
      console.error(error);
      setPhotoError(S.card.photoFailed);
    } finally {
      setPhotoBusy(false);
    }
  };

  const seasonNorm = normalizeSeason(draft.season);
  const seasonListed = seasonNorm !== null && seasonOptions.includes(seasonNorm);
  const showSeasonInput = seasonCustom || (draft.season !== "" && !seasonListed);
  const valueBad = valueText.trim() !== "" && parseValueTenths(valueText) === null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">{S.card.editTitle}</h1>
        <Btn tone="primary" onClick={() => goBack()}>
          {S.common.done}
        </Btn>
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
              <Btn tone="ghost" onClick={() => void guardWrite(() => CardRepo.removePhoto(cardId), S.card.photoSubject)} disabled={photoBusy}>
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

          <div className="grid grid-cols-[7rem_1fr] gap-2">
            <Field label={S.card.number} htmlFor="karte-nummer" hint={S.card.numberHint}>
              <input
                id="karte-nummer"
                type="text"
                inputMode="numeric"
                value={draft.number}
                onChange={(e) => patch({ number: e.target.value })}
                autoComplete="off"
                className={`${INPUT} text-center tabular-nums`}
              />
            </Field>
            <Field label={S.card.name} htmlFor="karte-name" error={draft.name.trim() === "" ? S.card.nameMissing : null}>
              <input
                id="karte-name"
                type="text"
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder={S.card.namePlaceholder}
                autoComplete="off"
                className={INPUT}
              />
            </Field>
          </div>

          <Field label={S.card.position}>
            <div className="grid grid-cols-4 gap-1.5" role="group" aria-label={S.card.position}>
              {POSITIONS.map((p: Position) => {
                const active = draft.position === p;
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={active}
                    onClick={() => patch({ position: p })}
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

          {/* DEF vor ATT — seine Reihenfolge, mit dem ausgeschriebenen Wort darunter. */}
          <div className="grid grid-cols-3 gap-2">
            <NumField id="karte-def" label={S.card.def} hint={S.card.defLong} value={draft.def} onChange={(def) => patch({ def })} />
            <NumField id="karte-att" label={S.card.att} hint={S.card.attLong} value={draft.att} onChange={(att) => patch({ att })} />
            <Field label={S.card.value} htmlFor="karte-wert" hint={S.card.valueHint} error={valueBad ? S.card.valueBad : null}>
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
    </div>
  );
}

/**
 * Ein Zahlenfeld, das bei 0 LEER ist: sonst stünde eine 0 im Feld, die er erst löschen
 * müsste, bevor er tippt.
 */
function NumField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
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
        className={`${INPUT} text-center text-2xl font-semibold tabular-nums`}
      />
    </Field>
  );
}
