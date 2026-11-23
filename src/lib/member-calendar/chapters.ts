/**
 * Chapter prefixes for the member calendar (PRD 008, R4).
 *
 * Organizers title events `<Chapter> - <Event title>`. The first dash
 * surrounded by spaces (- – —) separates the prefix. Prefix matching is
 * case-insensitive against each chapter's aliases. Titles with no prefix,
 * or an unknown one, are "General" and keep their full title.
 *
 * A leading `Interest - ` marks an event that is gauging interest
 * (e.g. `Interest - NOVA - Trunk or Treat`). It is removed, the event is
 * flagged `interest`, and the rest of the title is parsed as usual.
 *
 * Browser-safe: used by both the API and the calendar island.
 */

export type ChapterKey =
  | "blue-ridge"
  | "central"
  | "nova"
  | "fredericksburg"
  | "southeast"
  | "virtual";

export interface Chapter {
  key: ChapterKey;
  label: string;
  short: string;
  aliases: readonly string[];
  /** Event background. Must give at least 4.5:1 contrast with `textColor`. */
  color: string;
  textColor: string;
  /** Virtual events get a dashed border and an icon (R4.8). */
  virtual?: boolean;
}

export const GENERAL_LABEL = "General";
export const GENERAL_SHORT = "Gen";
export const GENERAL_COLOR = "#3d4650";
export const GENERAL_TEXT_COLOR = "#ffffff";

export const CHAPTERS: readonly Chapter[] = [
  {
    key: "blue-ridge",
    label: "Blue Ridge",
    short: "BR",
    aliases: ["Blue Ridge", "CVille", "Charlottesville"],
    color: "#1f5fad",
    textColor: "#ffffff",
  },
  {
    key: "central",
    label: "Central",
    short: "CE",
    aliases: ["Central", "Richmond", "RVA"],
    color: "#b3261e",
    textColor: "#ffffff",
  },
  {
    key: "nova",
    label: "NoVA",
    short: "NO",
    aliases: ["NoVA"],
    color: "#6a3d9a",
    textColor: "#ffffff",
  },
  {
    key: "fredericksburg",
    label: "Fredericksburg",
    short: "FX",
    aliases: ["Fredericksburg", "FXBG"],
    color: "#2e6b30",
    textColor: "#ffffff",
  },
  {
    key: "southeast",
    label: "Southeast",
    short: "SE",
    aliases: ["Southeast", "757"],
    color: "#a14a00",
    textColor: "#ffffff",
  },
  {
    key: "virtual",
    label: "Virtual",
    short: "V",
    aliases: ["Virtual"],
    color: "#0b6e79",
    textColor: "#ffffff",
    virtual: true,
  },
];

const CHAPTER_BY_KEY = new Map<string, Chapter>(CHAPTERS.map((c) => [c.key, c]));

const ALIAS_LOOKUP = new Map<string, ChapterKey>(
  CHAPTERS.flatMap((c) => c.aliases.map((alias) => [normalizeAlias(alias), c.key] as const)),
);

function normalizeAlias(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function getChapter(key: string | null | undefined): Chapter | undefined {
  return key ? CHAPTER_BY_KEY.get(key) : undefined;
}

export function isChapterKey(value: unknown): value is ChapterKey {
  return typeof value === "string" && CHAPTER_BY_KEY.has(value);
}

export interface ParsedTitle {
  chapter: ChapterKey | null;
  title: string;
  /** Title started with `Interest - `. */
  interest: boolean;
}

/**
 * A dash (- – —) with whitespace on at least one side separates segments, so
 * "NoVA - X" and "Central- X" both split, but hyphenated words like
 * "Spider-Man" don't.
 */
const SEPARATOR = String.raw`(?:\s+[-–—]\s*|\s*[-–—]\s+)`;
/** First separator splits the prefix from the rest of the title. */
const PREFIX_PATTERN = new RegExp(String.raw`^\s*(.+?)${SEPARATOR}(.+?)\s*$`, "s");
/** "Interest", "(Interest)" or "[Interest]" as a leading segment. */
const INTEREST_PATTERN = new RegExp(
  String.raw`^\s*[([]?\s*interest\s*[)\]]?${SEPARATOR}(.+?)\s*$`,
  "is",
);

/** Removes a leading Interest segment, if there is one. */
function stripInterest(text: string): { text: string; interest: boolean } {
  const match = INTEREST_PATTERN.exec(text);
  return match ? { text: match[1], interest: true } : { text, interest: false };
}

function parseChapterPrefix(raw: string): { chapter: ChapterKey | null; title: string } {
  const match = PREFIX_PATTERN.exec(raw);
  if (!match) return { chapter: null, title: raw };

  const chapter = ALIAS_LOOKUP.get(normalizeAlias(match[1]));
  if (!chapter) return { chapter: null, title: raw };

  return { chapter, title: match[2] };
}

/**
 * The Interest tag may come before or after the chapter:
 * "Interest - NOVA - Title" and "NOVA - (Interest) - Title" both work.
 */
export function parseEventTitle(rawTitle: string | null | undefined): ParsedTitle {
  const raw = (rawTitle ?? "").trim();
  if (!raw) return { chapter: null, title: "(Untitled event)", interest: false };

  const leading = stripInterest(raw);
  const { chapter, title } = parseChapterPrefix(leading.text);
  const trailing = chapter ? stripInterest(title) : { text: title, interest: false };

  return {
    chapter,
    title: trailing.text,
    interest: leading.interest || trailing.interest,
  };
}

/* --- Contrast helpers (WCAG 2.x), used by tests to guard the palette --- */

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
