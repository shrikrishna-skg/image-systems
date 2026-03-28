const STORAGE_KEY = "iep:importUrlHistory:v1";
const MAX_ENTRIES = 80;

export type ImportUrlHistoryEntry = {
  /** What the user typed or chose */
  inputUrl: string;
  /** Server-resolved URL after redirects */
  finalUrl: string;
  scannedAt: string;
  imageCount: number;
  truncated: boolean;
};

function safeParse(raw: string | null): ImportUrlHistoryEntry[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (row): row is ImportUrlHistoryEntry =>
          row &&
          typeof row === "object" &&
          typeof (row as ImportUrlHistoryEntry).inputUrl === "string" &&
          typeof (row as ImportUrlHistoryEntry).finalUrl === "string" &&
          typeof (row as ImportUrlHistoryEntry).scannedAt === "string",
      )
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function loadImportUrlHistory(): ImportUrlHistoryEntry[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

function persist(entries: ImportUrlHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* quota / private mode */
  }
}

/** Append or move-to-front by inputUrl (normalized trim). */
export function recordImportUrlScan(entry: Omit<ImportUrlHistoryEntry, "scannedAt"> & { scannedAt?: string }): void {
  const scannedAt = entry.scannedAt ?? new Date().toISOString();
  const input = entry.inputUrl.trim();
  const finalUrl = entry.finalUrl.trim() || input;
  if (!input) return;

  const prev = loadImportUrlHistory().filter((e) => e.inputUrl.trim() !== input);
  const next: ImportUrlHistoryEntry = {
    inputUrl: input,
    finalUrl,
    scannedAt,
    imageCount: entry.imageCount,
    truncated: entry.truncated,
  };
  persist([next, ...prev].slice(0, MAX_ENTRIES));
}

export function removeImportUrlHistoryEntry(inputUrl: string): void {
  const t = inputUrl.trim();
  persist(loadImportUrlHistory().filter((e) => e.inputUrl.trim() !== t));
}

export function clearImportUrlHistory(): void {
  persist([]);
}
