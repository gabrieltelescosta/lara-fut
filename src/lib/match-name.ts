/** Separator used by Superbet virtual match names: "Home (V)·Away (V)" */
const SEP = "·";

export type ParsedMatchName = {
  home: string;
  away: string;
};

export function parseMatchName(matchName: string): ParsedMatchName | null {
  const t = matchName.trim();
  const i = t.indexOf(SEP);
  if (i <= 0 || i >= t.length - 1) return null;
  const home = t.slice(0, i).trim();
  const away = t.slice(i + SEP.length).trim();
  if (!home || !away) return null;
  return { home, away };
}

export function teamSlug(name: string): string {
  return encodeURIComponent(name);
}

export function teamFromSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}
