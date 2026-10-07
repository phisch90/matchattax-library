import type { CollectionsState } from "../lib/hooks.js";
import { S } from "../strings.js";
import { Segmented } from "./bits.js";

/** Seine Sammlung oder die seines Sohnes — oben auf Sammlung und Teams, immer dieselbe Leiste. */
export function CollectionSwitcher({ state }: { state: CollectionsState }) {
  if (state.collections.length < 2 || state.current === null) return null;
  return (
    <Segmented
      label={S.collection.switcher}
      options={state.collections.map((c) => ({ value: c.id, label: c.name === "" ? "…" : c.name }))}
      value={state.current.id}
      onChange={state.setCurrent}
    />
  );
}
