import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { createPublicPreviewServices } from "./public-preview.js";
import "./styles.css";

const publicPreviewServices = import.meta.env.VITE_PUBLIC_FIXTURE_PREVIEW === "true"
  ? createPublicPreviewServices()
  : {};

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App {...publicPreviewServices} {...(globalThis.__WARDROBE_TEST_SERVICES__ || {})} />
  </React.StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}
