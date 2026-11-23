import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jwtOptions = vi.hoisted(() => [] as { scopes?: string[]; subject?: string }[]);

vi.mock("google-auth-library", () => {
  class JWT {
    constructor(public options: { scopes?: string[]; subject?: string }) {
      jwtOptions.push(options);
    }
    async getAccessToken() {
      return { token: `token-${this.options.subject ?? "sa"}-${this.options.scopes?.join(",")}` };
    }
  }
  return { JWT, ExternalAccountClient: { fromJSON: vi.fn() }, OAuth2Client: vi.fn() };
});
vi.mock("@vercel/oidc", () => ({ getVercelOidcToken: vi.fn() }));

const KEY = Buffer.from(
  JSON.stringify({ client_email: "sa@p.iam.gserviceaccount.com", private_key: "k" }),
).toString("base64");

describe("getGoogleAccessToken access modes", () => {
  beforeEach(() => {
    vi.resetModules();
    jwtOptions.length = 0;
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY = KEY;
    process.env.GOOGLE_DELEGATED_USER = "calendar-automation@ghostbustersva.com";
  });
  afterEach(() => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    delete process.env.GOOGLE_ACCESS_MODE;
    delete process.env.GOOGLE_DELEGATED_USER;
  });

  it("delegated mode impersonates the calendar user for Calendar calls only", async () => {
    process.env.GOOGLE_ACCESS_MODE = "delegated";
    const { getGoogleAccessToken, SCOPES } =
      await import("../src/lib/member-calendar/server/google-auth");
    await getGoogleAccessToken([SCOPES.calendar]);
    await getGoogleAccessToken([SCOPES.groups]);
    expect(jwtOptions).toEqual([
      {
        email: "sa@p.iam.gserviceaccount.com",
        key: "k",
        scopes: [SCOPES.calendar],
        subject: "calendar-automation@ghostbustersva.com",
      },
      {
        email: "sa@p.iam.gserviceaccount.com",
        key: "k",
        scopes: [SCOPES.groups],
        subject: undefined,
      },
    ]);
  });

  it("direct mode never impersonates", async () => {
    process.env.GOOGLE_ACCESS_MODE = "direct";
    const { getGoogleAccessToken, SCOPES } =
      await import("../src/lib/member-calendar/server/google-auth");
    await getGoogleAccessToken([SCOPES.calendar]);
    expect(jwtOptions[0].subject).toBeUndefined();
  });
});
