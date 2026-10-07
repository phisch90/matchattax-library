import { useMemo } from "react";
import { teamIssues, teamTotals } from "../core/team.js";
import { formatValue } from "../core/value.js";
import { TeamRepo, byId } from "../db/repo.js";
import { useCards, useCollections, useTeams } from "../lib/hooks.js";
import { navigate } from "../lib/router.js";
import { HREF } from "../lib/routes.js";
import { guardWrite } from "../lib/saveError.js";
import { S } from "../strings.js";
import { CollectionSwitcher } from "../ui/CollectionSwitcher.js";
import { Btn, Empty } from "../ui/bits.js";

export function TeamsPage() {
  const state = useCollections();
  const teams = useTeams(state.current?.id);
  const cards = useCards(state.current?.id);
  const map = useMemo(() => byId(cards ?? []), [cards]);

  const create = async (): Promise<void> => {
    const current = state.current;
    if (current === null) return;
    const name = S.teams.defaultName((teams?.length ?? 0) + 1);
    const result = await guardWrite(() => TeamRepo.create(current.id, name), S.teams.writeSubject);
    if (result.ok) navigate(HREF.team(result.value));
  };

  return (
    <div className="space-y-3">
      <CollectionSwitcher state={state} />

      {teams === undefined ? (
        <p className="text-sm text-slate-500">{S.common.loading}</p>
      ) : teams.length === 0 ? (
        <Empty title={S.teams.empty} text={S.teams.emptyHint}>
          <Btn tone="primary" onClick={() => void create()}>
            {S.teams.add}
          </Btn>
        </Empty>
      ) : (
        <>
          <ul className="space-y-2">
            {teams.map((t) => {
              const totals = teamTotals(t, map);
              const issues = teamIssues(t, map);
              return (
                <li key={t.id}>
                  <a
                    href={HREF.team(t.id)}
                    className="block rounded-xl border border-slate-800 bg-slate-900/60 p-3 hover:border-slate-600"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-base font-semibold">{t.name === "" ? "—" : t.name}</span>
                      <span className="shrink-0 text-xs text-slate-400">{t.formation}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 text-sm tabular-nums text-slate-300">
                      <span title={S.card.defLong}>
                        <strong className="text-slate-100">{totals.def}</strong> DEF
                      </span>
                      <span title={S.card.attLong}>
                        <strong className="text-slate-100">{totals.att}</strong> ATT
                      </span>
                      <span>{formatValue(totals.valueTenths)}</span>
                      <span className="text-slate-500">{S.teams.slotsOf(totals.filled)}</span>
                    </div>
                    {issues.length > 0 && (
                      <p className="mt-1 text-xs text-rose-300">
                        {issues.length} {issues.length === 1 ? "Hinweis" : "Hinweise"}
                      </p>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
          <Btn tone="primary" className="w-full" onClick={() => void create()}>
            {S.teams.add}
          </Btn>
        </>
      )}
    </div>
  );
}
