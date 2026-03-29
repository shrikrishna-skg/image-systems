# API surface (Spring Boot implementation)

Historical snapshot: [openapi.json](./openapi.json) (from the former Python app). Frontend consumers: `frontend/src/api/*.js`.

| Area | Prefix | Notes |
|------|--------|--------|
| Auth | `/api/auth` | `POST /local/session`, `GET/PUT /me` |
| API keys | `/api/keys` | CRUD + validate |
| Images | `/api/images` | upload, detail, file serving, enhance/upscale/pipeline, presets, cost estimate, suggest-filename |
| Jobs | `/api/jobs` | get by id, list |
| History | `/api/history` | list, `/usage` summary |
| Scrape | `/api/scrape` | embed-check, page, import-urls |
| Image generation | `/api/image-generation` | compose, generate |
| Knowledge | `/api/knowledge` | scenarios + filters |

OpenAPI is the authoritative schema for request/response bodies.
