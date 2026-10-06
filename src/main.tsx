import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { fitToApp, isNativeApp } from "@/lib/nativeApp";
import { fitViewport } from "@/lib/viewport";

fitViewport(isNativeApp);
fitToApp();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
