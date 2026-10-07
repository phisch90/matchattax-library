import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./styles.css";
import { startUpdateWatch } from "./lib/updateStore.js";
import { App } from "./ui/App.js";
import { ErrorBoundary } from "./ui/ErrorBoundary.js";

/*
  PWA: ein Update nie stillschweigend mitten in einer Serie — aber es MUSS ankommen.
  `startUpdateWatch` fragt bei Rückkehr in den Vordergrund, bei „wieder online" und
  halbstündlich nach; die Leiste dazu ist `ui/UpdateBar.tsx`, der Weg zum wirklichen
  Aktualisieren `lib/swUpdate.ts`. Ein `confirm()` an dieser Stelle ging auf dem
  iPhone nie auf.
*/
startUpdateWatch(registerSW);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* Der äußere Rahmen fängt, was in der Hülle selbst passiert; der innere je Seite steht in App.tsx. */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
