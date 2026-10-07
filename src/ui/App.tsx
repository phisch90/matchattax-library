import { useEffect, type ReactNode } from "react";
import { db, requestPersistentStorage } from "../db/db.js";
import { ensureSeeded } from "../db/repo.js";
import { useRoute } from "../lib/router.js";
import { HREF, navSection } from "../lib/routes.js";
import { CardFormPage } from "../pages/CardFormPage.js";
import { CardWizardPage } from "../pages/CardWizardPage.js";
import { CollectionPage } from "../pages/CollectionPage.js";
import { SettingsPage } from "../pages/SettingsPage.js";
import { TeamPage } from "../pages/TeamPage.js";
import { TeamsPage } from "../pages/TeamsPage.js";
import { S } from "../strings.js";
import { Empty } from "./bits.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { Layout } from "./Layout.js";

export function App() {
  const route = useRoute();

  useEffect(() => {
    void db.open().catch((error: unknown) => console.error(error));
    ensureSeeded().catch((error: unknown) => console.error(error));
    void requestPersistentStorage();
  }, []);

  let page: ReactNode;
  switch (route.kind) {
    case "sammlung":
      page = <CollectionPage />;
      break;
    case "karteNeu":
      // Anlegen in Serie, Wert für Wert — das volle Formular bleibt dem Bearbeiten.
      page = <CardWizardPage />;
      break;
    case "karte":
      // Der Schlüssel erzwingt ein frisches Formular je Karte — sonst bliebe der Entwurf der vorigen stehen.
      page = <CardFormPage key={route.id} id={route.id} />;
      break;
    case "teams":
      page = <TeamsPage />;
      break;
    case "team":
      page = <TeamPage key={route.id} id={route.id} />;
      break;
    case "einstellungen":
      page = <SettingsPage />;
      break;
    case "unbekannt":
      page = (
        <Empty title={S.common.notFound}>
          <a href={HREF.sammlung} className="text-emerald-300 underline">
            {S.common.toCollection}
          </a>
        </Empty>
      );
      break;
  }

  // Der Schlüssel ist die Adresse: ein Seitenwechsel setzt den Auffangrahmen zurück.
  return (
    <Layout section={navSection(route)}>
      <ErrorBoundary key={window.location.hash}>{page}</ErrorBoundary>
    </Layout>
  );
}
