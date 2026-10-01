import { registerServiceWorker } from "./pwa";
import { startI18n } from "./i18n";
import { startTheme } from "./theme"; // eng birinchi: o'rnatish hodisasini o'tkazib yubormaslik uchun
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ErrorBoundary, NetworkBanner } from "./components/Resilience";
import { AuthProvider } from "./auth";
import { ToastProvider } from "./components/ui";
import { SiteProvider } from "./site";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
    <NetworkBanner />
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <SiteProvider>
            <App />
          </SiteProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);


startTheme();
startI18n();
registerServiceWorker();
