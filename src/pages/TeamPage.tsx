import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FORMATIONS, formationOf, reslot, slotPositions } from "../core/formations.js";
import type { Position, Team } from "../core/model.js";
import { BUDGET_TENTHS, clearSlot, fitsSlot, placeCard, statForSlot, teamIssues, teamTotals } from "../core/team.js";
import { formatValue } from "../core/value.js";
import { db } from "../db/db.js";
import { TeamRepo, byId, hydrateTeam } from "../db/repo.js";
import { useCards, useMirror } from "../lib/hooks.js";
import { goBack } from "../lib/router.js";
import { HREF } from "../lib/routes.js";
import { guardWrite } from "../lib/saveError.js";
import { toast } from "../lib/toast.js";
import { S, issueText } from "../strings.js";
import { CardPicker } from "../ui/CardPicker.js";
import { CardThumb } from "../ui/CardThumb.js";
import { Box, Btn, Chip, DangerZone, Empty, INPUT } from "../ui/bits.js";

/** Die Reihen auf dem Platz, von oben (Sturm) nach unten (Tor) — wie man eine Aufstellung liest. */
const LINES: readonly Position[] = ["att", "mid", "def", "gk"];

export function TeamPage({ id }: { id: string }) {
  const teamRaw = useLiveQuery(() => db.teams.get(id).then((r) => r ?? null), [id]);
  const team: Team | null | undefined = useMemo(
    () => (teamRaw === null || teamRaw === undefined ? teamRaw : hydrateTeam(teamRaw)),
    [teamRaw],
  );
  const cards = useCards(team?.collectionId);
  const map = useMemo(() => byId(cards ?? []), [cards]);
  const rowsById = useMemo(() => new Map((cards ?? []).map((c) => [c.id, c])), [cards]);
  const [pickSlot, setPickSlot] = useState<number | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [budgetOn, setBudgetOn] = useMirror(team?.budgetOn ?? false);

  useEffect(() => {
    if (team !== null && team !== undefined && name === null) setName(team.name);
  }, [team, name]);

  if (team === undefined) return <p className="text-sm text-slate-500">{S.common.loading}</p>;
  if (team === null) {
    return (
      <Empty title={S.common.notFound}>
        <a href={HREF.teams} className="text-emerald-300 underline">
          {S.nav.teams}
        </a>
      </Empty>
    );
  }

  const formation = formationOf(team.formation);
  const positions = slotPositions(formation);
  const totals = teamTotals(team, map);
  const issues = teamIssues(team, map);
  const overBudget = team.budgetOn && totals.valueTenths > BUDGET_TENTHS;

  const update = (patch: Partial<Omit<Team, "id" | "collectionId" | "createdAt">>): void => {
    void guardWrite(() => TeamRepo.update(id, patch), S.teams.writeSubject);
  };

  const changeFormation = (key: string): void => {
    if (key === team.formation) return;
    const result = reslot(team.slots, formation, formationOf(key));
    update({ formation: key, slots: result.slots });
    if (result.dropped.length > 0) {
      toast(S.teams.reslotDropped(result.dropped.map((d) => map.get(d)?.name ?? "?")));
    }
  };

  const pickPosition: Position = pickSlot === null ? "gk" : (positions[pickSlot] ?? "gk");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Btn tone="ghost" onClick={() => goBack(HREF.teams)} aria-label={S.common.back}>
          ←
        </Btn>
        <input
          type="text"
          value={name ?? team.name}
          onChange={(e) => {
            setName(e.target.value);
            update({ name: e.target.value });
          }}
          aria-label={S.teams.name}
          className={`${INPUT} text-lg font-semibold`}
        />
      </div>

      <Box title={S.teams.formation}>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={S.teams.formation}>
          {FORMATIONS.map((f) => (
            <Chip key={f.key} active={f.key === team.formation} onClick={() => changeFormation(f.key)}>
              {f.key}
            </Chip>
          ))}
        </div>
      </Box>

      <Box>
        {/* DEF vor ATT — seine Reihenfolge, das ganze Wort als Tooltip. */}
        <dl className="grid grid-cols-4 gap-2 text-center" data-testid="totals">
          <div title={S.card.defLong}>
            <dt className="text-[10px] uppercase tracking-wider text-slate-500">{S.teams.totals.def}</dt>
            <dd className="text-xl font-semibold tabular-nums" data-testid="total-def">
              {totals.def}
            </dd>
          </div>
          <div title={S.card.attLong}>
            <dt className="text-[10px] uppercase tracking-wider text-slate-500">{S.teams.totals.att}</dt>
            <dd className="text-xl font-semibold tabular-nums" data-testid="total-att">
              {totals.att}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-slate-500">{S.teams.totals.value}</dt>
            <dd className={`text-xl font-semibold tabular-nums ${overBudget ? "text-rose-300" : ""}`} data-testid="total-value">
              {formatValue(totals.valueTenths)}
            </dd>
            {team.budgetOn && <dd className="text-[10px] text-slate-500">von {formatValue(BUDGET_TENTHS)}</dd>}
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-slate-500">{S.teams.totals.slots}</dt>
            <dd className="text-xl font-semibold tabular-nums" data-testid="total-slots">
              {S.teams.slotsOf(totals.filled)}
            </dd>
          </div>
        </dl>
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={budgetOn}
            onChange={(e) => {
              setBudgetOn(e.target.checked);
              update({ budgetOn: e.target.checked });
            }}
            className="mt-0.5 h-5 w-5 accent-emerald-500"
          />
          <span>
            {S.teams.budget}
            <span className="block text-xs text-slate-500">{S.teams.budgetHint}</span>
          </span>
        </label>
      </Box>

      <section
        aria-label="Aufstellung"
        className="rounded-xl border border-emerald-900/60 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.14),_rgba(2,6,23,0))] p-2 sm:p-3"
        data-testid="pitch"
      >
        {LINES.map((line) => {
          const indices = positions.map((p, i) => (p === line ? i : -1)).filter((i) => i !== -1);
          return (
            <div key={line} className="py-1.5" data-line={line}>
              <div className="mb-1 text-center text-[10px] uppercase tracking-wider text-slate-500">
                {S.teams.lines[line]}
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {indices.map((i) => {
                  const cardId = team.slots[i] ?? null;
                  const card = cardId === null ? null : (rowsById.get(cardId) ?? null);
                  const mismatch = card !== null && card.position !== line;
                  const missing = cardId !== null && card === null;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPickSlot(i)}
                      data-slot={i}
                      aria-label={`Platz ${i}: ${card === null ? "frei" : card.name}`}
                      className={`flex w-[68px] flex-col items-center rounded-lg border p-1 sm:w-[88px] ${
                        card === null
                          ? missing
                            ? "border-rose-500 border-dashed text-rose-300"
                            : "min-h-[88px] justify-center border-dashed border-slate-600 text-slate-400 hover:border-slate-400"
                          : mismatch
                            ? "border-rose-500 bg-slate-900"
                            : "border-slate-700 bg-slate-900 hover:border-slate-500"
                      }`}
                    >
                      {card === null ? (
                        <span className="text-sm font-medium">{missing ? "?" : S.teams.emptySlot(line)}</span>
                      ) : (
                        <>
                          <CardThumb thumb={card.thumb} position={card.position} className="h-14 w-10 rounded text-xs sm:h-[70px] sm:w-[50px]" />
                          {/* Zwei Zeilen statt Auslassungspunkten: auf 68 px bleibt von „Schlotterbeck" sonst „Schlott…". */}
                          <span className="mt-1 line-clamp-2 w-full break-words text-center text-[11px] font-medium leading-tight">
                            {card.name}
                          </span>
                          <span className="text-[10px] tabular-nums text-slate-400">
                            {line === "mid" ? `${card.def} / ${card.att}` : statForSlot(card, line)}
                          </span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      <Box title={S.teams.issuesTitle}>
        {issues.length === 0 ? (
          <p className="text-sm text-emerald-300" data-testid="issues-ok">
            {S.teams.ok}
          </p>
        ) : (
          <ul className="space-y-1" data-testid="issues">
            {issues.map((issue, i) => (
              <li key={i} className="text-sm text-rose-200">
                {issueText(issue)}
              </li>
            ))}
          </ul>
        )}
      </Box>

      <DangerZone
        label={S.teams.delete}
        hint={S.teams.deleteHint}
        confirmLabel={S.teams.deleteConfirm(team.name === "" ? "Team" : team.name)}
        onConfirm={() => {
          const teamName = team.name;
          void guardWrite(() => TeamRepo.remove(id), S.teams.writeSubject).then((result) => {
            if (!result.ok) return;
            toast(S.teams.deleted(teamName === "" ? "Team" : teamName));
            goBack(HREF.teams);
          });
        }}
      />

      <CardPicker
        slot={pickSlot}
        position={pickPosition}
        team={team}
        cards={cards ?? []}
        onPick={(cardId) => {
          if (pickSlot === null) return;
          // Die zweite Hälfte der Sperre: der Auswähler bietet nur Passendes an, und
          // gesetzt wird trotzdem nur, was passt — sonst hinge die Regel an einer Liste.
          const card = map.get(cardId);
          if (card === undefined || !fitsSlot(card, pickPosition)) return;
          update({ slots: placeCard(team.slots, pickSlot, cardId) });
          setPickSlot(null);
        }}
        onClear={() => {
          if (pickSlot === null) return;
          update({ slots: clearSlot(team.slots, pickSlot) });
          setPickSlot(null);
        }}
        onClose={() => setPickSlot(null)}
      />
    </div>
  );
}
