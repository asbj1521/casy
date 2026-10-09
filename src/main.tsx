import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./theme.css";
import App from "./App.tsx";
import { fitToApp, isNativeApp } from "@/lib/nativeApp";
import { applyTheme, storedTheme } from "@/lib/theme";
import { fitViewport } from "@/lib/viewport";

fitViewport(isNativeApp);
fitToApp();
// A theme forced on the profile, before anything is drawn (the app always follows the phone).
applyTheme(storedTheme(isNativeApp));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
