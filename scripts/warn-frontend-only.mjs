#!/usr/bin/env node
/**
 * Printed when running `npm run dev:web` — frontend alone has no API on :8000.
 */
console.warn(
  "\n\x1b[33m[dev:web]\x1b[0m Frontend only. Sign-in and API keys need the backend on port 8000.\n" +
    "           From the \x1b[1mrepo root\x1b[0m run:  \x1b[1mnpm run dev\x1b[0m  (API + web)\n" +
    "           Or:  \x1b[1mLOCAL_DEV_MODE=true npm run backend\x1b[0m  in another terminal.\n"
);
