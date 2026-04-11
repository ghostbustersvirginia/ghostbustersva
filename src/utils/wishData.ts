const WISH_PROXY_ENDPOINT = "https://wish.j5bot.workers.dev/site/CRTeamraiserAPI";

export type WishData = {
  raised: number;
  goal: number;
};

type WishTeam = {
  fundraisingGoal?: number | string;
  totalAmountRaised?: number | string;
  goal?: number | string;
  amountRaised?: number | string;
};

type WishApiResponse = {
  getTeamSearchByInfoResponse?: {
    team?: WishTeam | WishTeam[];
  };
  data?: {
    getTeamSearchByInfoResponse?: {
      team?: WishTeam | WishTeam[];
    };
  };
};

const REQUEST_PARAMS: Record<string, string> = {
  method: "getTeamsByInfo",
  fr_id: "7464",
  team_id: "58435",
  api_key: "mu3fefod",
  v: "1.0",
  response_format: "json",
};
const REQUEST_TIMEOUT_MS = 10000;

export class WishRequestTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Wish API request timed out after ${timeoutMs}ms.`);
    this.name = "WishRequestTimeoutError";
  }
}

export function isWishRequestTimeoutError(error: unknown): error is WishRequestTimeoutError {
  return error instanceof WishRequestTimeoutError;
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

function centsToDollars(value: unknown): number {
  const cents = Number(value);
  if (!Number.isFinite(cents)) {
    throw new Error("Invalid cents value in wish API response.");
  }

  return Math.max(0, cents / 100);
}

export async function getWishData(): Promise<WishData> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(WISH_PROXY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: new URLSearchParams(REQUEST_PARAMS),
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new WishRequestTimeoutError(REQUEST_TIMEOUT_MS);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Wish API request failed: ${response.status}`);
  }

  const payload = (await response.json()) as WishApiResponse;
  const teamNode =
    payload?.data?.getTeamSearchByInfoResponse?.team ?? payload?.getTeamSearchByInfoResponse?.team;
  const team = Array.isArray(teamNode) ? teamNode[0] : teamNode;

  if (!team) {
    throw new Error("Wish API payload missing team data.");
  }

  return {
    raised: centsToDollars(team.totalAmountRaised ?? team.amountRaised),
    goal: centsToDollars(team.fundraisingGoal ?? team.goal),
  };
}
