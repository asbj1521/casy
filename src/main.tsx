import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./theme.css";
import App from "./App.tsx";
import CrashScreen from "@/components/CrashScreen";
import { fitToApp, isNativeApp } from "@/lib/nativeApp";
import { applyTheme, storedTheme, syncNativeTheme } from "@/lib/theme";
import { reloadOnStaleChunks } from "@/lib/staleChunks";
import { fitViewport } from "@/lib/viewport";

fitViewport(isNativeApp);
// A page opened before a deploy, asking for code that no longer exists: reloaded once (#157).
reloadOnStaleChunks();
fitToApp();
// A theme forced in Settings, before anything is drawn; the app is told too, in case it started in another.
applyTheme(storedTheme());
syncNativeTheme(storedTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CrashScreen>
      <App />
    </CrashScreen>
  </StrictMode>,
);
