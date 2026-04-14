const GIVEBACK_ENDPOINT = "https://gb.j5bot.workers.dev/ghostbustersgiveback/";
const TEAM_NAME = "Ghostbusters, Virginia";
const GIVEBACK_GOAL = 25000;
const REQUEST_TIMEOUT_MS = 10000;

export type GivebackData = {
  raised: number;
  goal: number;
};

export class GivebackRequestTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Giveback request timed out after ${timeoutMs}ms.`);
    this.name = "GivebackRequestTimeoutError";
  }
}

export function isGivebackRequestTimeoutError(
  error: unknown,
): error is GivebackRequestTimeoutError {
  return error instanceof GivebackRequestTimeoutError;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof (error as { name?: unknown }).name === "string" &&
    (error as { name: string }).name === "AbortError"
  );
}

/**
 * Parse a raw dollar string from the markup into a whole-dollar integer.
 * Strips currency symbols, commas, and whitespace before parsing.
 */
function parseDollars(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const value = parseFloat(cleaned);
  if (!Number.isFinite(value) || cleaned === "") {
    throw new Error(`Invalid raised amount in Giveback markup: "${raw}"`);
  }
  return Math.round(value);
}

/**
 * Extract the GBVA total from the raw markup.
 * The markup contains lines like:
 *   …Ghostbusters, Virginia…
 *   :"$1,234",
 */
function parseMarkup(markup: string): GivebackData {
  const lines = markup.split("\n");

  const teamLineIndex = lines.findIndex((line) => line.includes(TEAM_NAME));
  if (teamLineIndex === -1) {
    throw new Error(`Giveback markup does not contain team "${TEAM_NAME}".`);
  }

  const totalLine = lines[teamLineIndex + 1];
  if (totalLine === undefined || totalLine.trim() === "") {
    throw new Error(`Giveback markup missing total line after "${TEAM_NAME}".`);
  }

  const parts = totalLine.split(':"');
  if (parts.length < 2) {
    throw new Error(`Giveback total line has unexpected format: "${totalLine.trim()}"`);
  }

  // parts[1] looks like: `$1,234",` — drop the trailing two chars (`",`)
  const rawValue = parts[1].slice(0, -2);

  return { raised: parseDollars(rawValue), goal: GIVEBACK_GOAL };
}

export async function getGivebackData(): Promise<GivebackData> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(GIVEBACK_ENDPOINT, {
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new GivebackRequestTimeoutError(REQUEST_TIMEOUT_MS);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Giveback request failed: ${response.status}`);
  }

  const markup = await response.text();
  return parseMarkup(markup);
}

