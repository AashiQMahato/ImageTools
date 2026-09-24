# Image Tools — Backend

Express 5 + TypeScript (strict) API. All image-provider integrations and API keys live here.

```bash
npm install
cp .env.example .env
npm run dev      # tsx watch, http://localhost:5000
npm run build    # compile to dist/
npm run start    # run dist/server.js
```

| Method | Path                     | Response                    |
| ------ | ------------------------ | --------------------------- |
| GET    | `/api/health`            | `200` API is running        |
| POST   | `/api/remove-background` | `501` not implemented yet   |
| POST   | `/api/upscale`           | `501` not implemented yet   |

Request flow: `routes → middleware (rate limit, upload) → controllers → services → provider`. To add a provider, implement `BackgroundRemovalProvider` or `UpscaleProvider` (`src/types/image.ts`) in the matching `src/services/*` folder and return it from that service's `getProvider()`.

On macOS, port 5000 is taken by AirPlay Receiver — disable it or set `PORT` in `.env`.

See the [root README](../README.md) for the full overview.
