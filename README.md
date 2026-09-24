# Image Tools

An AI-powered image utility platform: background removal, upscaling, cropping, resizing, rotation/flip, before/after comparison, preview and download.

> **Status:** foundation plus the public landing page. No image processing or AI features are implemented yet.

## Architecture

```text
image-tools/
├── frontend/   React SPA (Vite) — UI only, talks exclusively to our backend
└── backend/    Express API — owns all provider integrations and API keys
```

Each app has its own `package.json`, build and environment, so they can be deployed independently. The browser never calls external image providers and never sees provider API keys: requests go `frontend → /api/* → backend service → provider`.

## Frontend stack

React 19 · Vite · TypeScript (strict) · Tailwind CSS v4 · Untitled UI · React Router · Zustand · Lucide React · react-easy-crop (installed, not used yet)

### Untitled UI

Set up with the official CLI (`npx untitledui@latest init --vite`), which provides:

- `src/styles/theme.css` — design tokens (colors, typography, radius, shadows) for light and dark mode
- `src/styles/globals.css` / `typography.css` — Tailwind base, plugins and the `dark` variant (`.dark-mode` class on `<html>`)
- Components are added with `npx untitledui@latest add <component> -p components/ui` and live in `src/components/ui/` (currently: `button`, `badges`)
- The brand scale is set to neutral in `theme.css`, and `src/index.css` makes the solid brand surface near-black in light mode and near-white in dark mode, so primary actions invert with the theme

Use the semantic token classes (`bg-primary`, `text-tertiary`, `border-secondary`, `bg-brand-solid`, …) rather than raw palette colors. Untitled UI components use `@/lib/utils/cx`; the CLI writes new components with `@/utils/cx`, so update that import after adding a component. shadcn/ui is intentionally not used.

## Backend stack

Node.js · Express 5 · TypeScript (strict) · Helmet · CORS · express-rate-limit · Multer (in-memory) · Morgan · dotenv · tsx (dev)

## Folder structure

```text
frontend/src/
├── assets/          images/, icons/
├── components/      ui/ (Untitled UI), layout/ (Navbar, Footer), common/ (Logo, UploadButton…), landing/ (home page sections)
├── features/        background-removal/, upscaler/, cropper/, image-editor/
├── pages/           Home/, RemoveBackground/, Upscaler/, Cropper/, Editor/
├── hooks/           useTheme, useInView, useImageUpload, useScrolled, usePrefersReducedMotion
├── lib/             api/ (typed client), utils/ (cx, cn), constants/ (routes, navigation, upload)
├── store/           Zustand stores
├── types/           shared types
└── routes/          React Router config

backend/src/
├── config/          env + upload config
├── controllers/     HTTP layer only
├── middleware/      rate limiter, upload, error handling
├── routes/          /api router
├── services/        background-removal/, upscaling/, image-processing/ (provider logic)
├── types/  utils/
├── app.ts           Express app
└── server.ts        entry point
```

Providers are swapped behind the `BackgroundRemovalProvider` / `UpscaleProvider` interfaces (`backend/src/types/image.ts`); controllers only call services.

## Installation

Requires Node.js 20.6+.

```bash
npm install            # root: installs concurrently
npm run install:all    # frontend + backend
cp backend/.env.example backend/.env
```

## Development

| Where      | Command           | Description                                  |
| ---------- | ----------------- | -------------------------------------------- |
| root       | `npm run dev`     | Run backend and frontend together            |
| root       | `npm run build`   | Build both apps                              |
| `frontend` | `npm run dev`     | Vite dev server on http://localhost:5173     |
| `frontend` | `npm run build`   | Type-check and build to `dist/`              |
| `frontend` | `npm run preview` | Preview the production build                 |
| `backend`  | `npm run dev`     | API with hot reload (tsx) on port 5000       |
| `backend`  | `npm run build`   | Compile TypeScript to `dist/`                |
| `backend`  | `npm run start`   | Run the compiled API                         |

In development, Vite proxies `/api` to the backend, so no CORS setup is needed locally.

> **macOS:** port 5000 is used by AirPlay Receiver. Either turn it off (System Settings → General → AirDrop & Handoff → AirPlay Receiver) or set `PORT=5050` in `backend/.env` and `API_PROXY_TARGET=http://localhost:5050` in `frontend/.env`.

## Environment variables

**backend/.env**

| Variable            | Default                 | Description                                    |
| ------------------- | ----------------------- | ---------------------------------------------- |
| `PORT`              | `5000`                  | API port                                       |
| `FRONTEND_URL`      | `http://localhost:5173` | Allowed CORS origin(s), comma-separated        |
| `REMOVE_BG_API_KEY` | —                       | Background-removal provider key (server only)  |
| `UPSCALE_API_KEY`   | —                       | Upscaling provider key (server only)           |

**frontend/.env** (optional)

| Variable            | Description                                                                 |
| ------------------- | --------------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | Backend URL for production builds. Empty in dev. Never put secrets in `VITE_*`. |
| `API_PROXY_TARGET`  | Dev-server proxy target (not bundled). Defaults to `http://localhost:5000`.  |

`.env` files are git-ignored; only `.env.example` files are committed.

## API endpoints

| Method | Path                     | Status                                                |
| ------ | ------------------------ | ----------------------------------------------------- |
| GET    | `/api/health`            | `200 { "success": true, "message": "Image Tools API is running" }` |
| POST   | `/api/remove-background` | `501 NOT_IMPLEMENTED` (accepts `multipart/form-data`, field `image`) |
| POST   | `/api/upscale`           | `501 NOT_IMPLEMENTED` (field `image`, optional `scale` = 2 or 4) |

Uploads: JPEG, PNG or WebP, max 10 MB, held in memory. Errors use `{ "success": false, "message", "code" }`.

## Planned features

- AI background removal and upscaling (backend provider integrations)
- Cropping, resizing, rotation/flip
- Before/after comparison, preview and download
- Later: batch processing and more AI tools
