import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { restoreDraftImage } from "./store/useImageStore";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element #root not found");

// Restore the draft image first (IndexedDB is fast), but never hold up the page for long.
await Promise.race([restoreDraftImage().catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 1500))]);

createRoot(rootElement).render(
    <StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </StrictMode>,
);
