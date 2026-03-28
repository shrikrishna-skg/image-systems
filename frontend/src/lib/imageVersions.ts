import type { ImageVersion } from "../types";

/** Newest output first — DB/ORM order of `versions` is not guaranteed. */
export function getLatestImageVersion(
  versions: ImageVersion[] | undefined | null
): ImageVersion | undefined {
  if (!versions?.length) return undefined;
  return [...versions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];
}
