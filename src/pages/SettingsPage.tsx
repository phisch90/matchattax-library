import { useEffect, useState, type ChangeEvent } from "react";
import type { Collection } from "../core/model.js";
import { CollectionRepo } from "../db/repo.js";
import { applyBackup, exportAndRemember, parseBackup, type Backup } from "../lib/backup.js";
import { useAppSettings, useCollections } from "../lib/hooks.js";
import { guardWrite } from "../lib/saveError.js";
import { toast } from "../lib/toast.js";
import { useUpdateStore } from "../lib/updateStore.js";
import { RUNNING, compareVersions, formatBuildTime, versionLabel } from "../lib/version.js";
import { S } from "../strings.js";
import { Box, Btn, Field, INPUT, Sheet } from "../ui/bits.js";

export function SettingsPage() {
  const state = useCollections();
  const settings = useAppSettings();
  const [withPhotos, setWithPhotos] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<Backup | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [usedMb, setUsedMb] = useState<string | null>(null);
  const deployed = useUpdateStore((s) => s.deployed);
  const busy = useUpdateStore((s) => s.busy);
  const apply = useUpdateStore((s) => s.apply);

  useEffect(() => {
    let alive = true;
    void navigator.storage
      ?.estimate?.()
      .then((e) => {
        if (alive && e?.usage !== undefined) setUsedMb((e.usage / 1_048_576).toFixed(1).replace(".", ","));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const doExport = async (): Promise<void> => {
    setExporting(true);
    try {
      await guardWrite(() => exportAndRemember(withPhotos), "Die Sicherung");
    } finally {
      setExporting(false);
    }
  };

  const onImportFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;
    setImportError(null);
    try {
      setPendingImport(parseBackup(await file.text()));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : S.settings.importFailed);
    }
  };

  const doImport = async (): Promise<void> => {
    if (pendingImport === null) return;
    setImporting(true);
    try {
      const counts = await applyBackup(pendingImport);
      toast(S.settings.importDone(counts.cards));
      setPendingImport(null);
    } catch (error) {
      console.error(error);
      setImportError(S.settings.importFailed);
    } finally {
      setImporting(false);
    }
  };

  const compared = compareVersions(RUNNING, deployed);

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">{S.settings.title}</h1>

      <Box title={S.settings.collections}>
        <p className="mb-2 text-xs text-slate-500">{S.settings.collectionsHint}</p>
        <ul className="space-y-2">
          {state.collections.map((c) => (
            <li key={c.id}>
              <CollectionNameField collection={c} />
            </li>
          ))}
        </ul>
        <Btn
          className="mt-2"
          onClick={() =>
            void guardWrite(
              () => CollectionRepo.add(S.settings.collectionNew(state.collections.length + 1)),
              S.settings.collectionSubject,
            )
          }
        >
          {S.settings.collectionAdd}
        </Btn>
      </Box>

      <Box title={S.settings.backup}>
        <p className="text-sm text-slate-300">{S.settings.backupHint}</p>
        <p className="mt-1 text-xs text-slate-500" data-testid="last-export">
          {S.settings.backupLast(formatBuildTime(settings.lastExportAt))}
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={withPhotos}
            onChange={(e) => setWithPhotos(e.target.checked)}
            className="h-5 w-5 accent-emerald-500"
          />
          {S.settings.backupWithPhotos}
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn tone="primary" onClick={() => void doExport()} disabled={exporting}>
            {exporting ? S.settings.backupBusy : S.settings.backupSave}
          </Btn>
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium hover:bg-slate-800">
            {S.settings.backupLoad}
            <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onImportFile(e)} />
          </label>
        </div>
        {importError !== null && <p className="mt-2 text-sm text-rose-300">{importError}</p>}
      </Box>

      <Box title={S.settings.storage}>
        <p className="text-sm text-slate-300">
          {usedMb === null ? S.settings.storageUnknown : S.settings.storageUsed(usedMb)}
        </p>
      </Box>

      <Box title={S.settings.version}>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">{S.settings.versionRunning}</dt>
            <dd className="tabular-nums" data-testid="version-running">
              {versionLabel(RUNNING)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">{S.settings.versionDeployed}</dt>
            <dd className="text-right tabular-nums">
              {compared.kind === "unbekannt"
                ? S.settings.versionUnknown
                : compared.kind === "aktuell"
                  ? S.settings.versionCurrent
                  : `${versionLabel(compared.deployed)} — ${S.settings.versionStale}`}
            </dd>
          </div>
        </dl>
        {compared.kind === "veraltet" && (
          <Btn tone="primary" className="mt-3" onClick={() => void apply()} disabled={busy}>
            {busy ? S.update.busy : S.update.apply}
          </Btn>
        )}
      </Box>

      <Sheet open={pendingImport !== null} title={S.settings.importTitle} onClose={() => setPendingImport(null)}>
        {pendingImport !== null && (
          <div className="space-y-3">
            <p className="text-sm">
              {S.settings.importSummary(
                pendingImport.collections.length,
                pendingImport.cards.length,
                pendingImport.teams.length,
              )}
            </p>
            <p className="text-xs text-slate-400">{S.settings.importHint}</p>
            <div className="flex gap-2">
              <Btn onClick={() => setPendingImport(null)}>{S.common.cancel}</Btn>
              <Btn tone="primary" onClick={() => void doImport()} disabled={importing}>
                {S.settings.importDo}
              </Btn>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

/** Der Name einer Sammlung — durchgeschrieben bei jedem Zeichen. */
function CollectionNameField({ collection }: { collection: Collection }) {
  const [name, setName] = useState(collection.name);
  return (
    <Field label={S.card.collection} htmlFor={`sammlung-${collection.id}`}>
      <input
        id={`sammlung-${collection.id}`}
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          void guardWrite(() => CollectionRepo.rename(collection.id, e.target.value), S.settings.collectionSubject);
        }}
        className={INPUT}
      />
    </Field>
  );
}
