# Image Tools — Frontend

React + Vite + TypeScript (strict) SPA styled with Tailwind CSS v4 and Untitled UI.

```bash
npm install
npm run dev       # http://localhost:5173 (proxies /api to the backend)
npm run build     # type-check + production build
npm run preview   # serve the production build
```

- Routes: `/`, `/remove-background`, `/upscale`, `/crop`, `/editor` (`src/routes/AppRoutes.tsx`)
- Untitled UI components: `src/components/ui/` — add more with `npx untitledui@latest add <name> -p components/ui`, then change `@/utils/cx` imports to `@/lib/utils/cx`
- API calls go through `src/lib/api/apiClient.ts` to our backend only. Set `VITE_API_BASE_URL` when the API is hosted on another origin.

See the [root README](../README.md) for the full overview.
