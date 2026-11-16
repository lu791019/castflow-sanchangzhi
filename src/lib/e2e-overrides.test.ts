import { describe, expect, it } from "vitest";
import { authEmailBlocked, externalOverridesAllowed } from "./e2e-overrides";

describe("externalOverridesAllowed", () => {
  it("next dev（非 production）可覆寫", () => {
    expect(externalOverridesAllowed({ NODE_ENV: "development" })).toBe(true);
    expect(externalOverridesAllowed({ NODE_ENV: "test" })).toBe(true);
  });

  it("production 預設不可覆寫，設 E2E_EXTERNAL_MOCKS=on 才可", () => {
    expect(externalOverridesAllowed({ NODE_ENV: "production" })).toBe(false);
    expect(externalOverridesAllowed({ NODE_ENV: "production", E2E_EXTERNAL_MOCKS: "1" })).toBe(false);
    expect(externalOverridesAllowed({ NODE_ENV: "production", E2E_EXTERNAL_MOCKS: "on" })).toBe(true);
  });

  it("Cloud Run（K_SERVICE）一律不可覆寫", () => {
    expect(externalOverridesAllowed({ NODE_ENV: "production", E2E_EXTERNAL_MOCKS: "on", K_SERVICE: "castflow" })).toBe(false);
  });
});

describe("authEmailBlocked", () => {
  it("只有 E2E_BLOCK_AUTH_EMAIL=on 才擋", () => {
    expect(authEmailBlocked({})).toBe(false);
    expect(authEmailBlocked({ E2E_BLOCK_AUTH_EMAIL: "1" })).toBe(false);
    expect(authEmailBlocked({ E2E_BLOCK_AUTH_EMAIL: "on" })).toBe(true);
  });

  it("Cloud Run（有 K_SERVICE）一律不擋，避免正式站誤設後無法登入", () => {
    expect(authEmailBlocked({ E2E_BLOCK_AUTH_EMAIL: "on", K_SERVICE: "castflow" })).toBe(false);
  });
});
