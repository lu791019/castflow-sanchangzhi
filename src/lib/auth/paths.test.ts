import { describe, expect, it } from "vitest";
import {
  isPenNameExemptPath,
  isProtectedPage,
  loginRedirectPath,
  tasteOnboardingPath,
  safeNextPath,
} from "./paths";

describe("isProtectedPage", () => {
  it.each([
    "/before",
    "/me",
    "/settings",
    "/proof/0b7c4c4e-6a1f-4e3b-9d33-1f0c2a3b4c5d",
    "/dashboard",
    "/episodes",
    "/episodes/new",
    "/episodes/abc/edit",
    "/schedule",
    "/styles/new",
    "/journal",
    "/notifications",
    "/onboarding/pen-name",
  ])("%s 需要登入", (path) => {
    expect(isProtectedPage(path)).toBe(true);
  });

  it.each([
    "/",
    // 先說後登入：說一段頁公開，送出時才要求登入
    "/say",
    "/s/abc123",
    "/works",
    "/works/some-slug",
    "/episodes/0b7c4c4e-6a1f-4e3b-9d33-1f0c2a3b4c5d/read",
    "/login",
    "/auth/callback",
    "/dev/nav",
    "/sayings",
    "/media",
  ])("%s 公開", (path) => {
    expect(isProtectedPage(path)).toBe(false);
  });
});

describe("isPenNameExemptPath", () => {
  it("取筆名頁本身與登出不再導向取筆名", () => {
    expect(isPenNameExemptPath("/onboarding/pen-name")).toBe(true);
    expect(isPenNameExemptPath("/me")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("站內路徑原樣保留（含 query）", () => {
    expect(safeNextPath("/me")).toBe("/me");
    expect(safeNextPath("/say?work=abc")).toBe("/say?work=abc");
  });

  it.each([
    null,
    undefined,
    "",
    "https://evil.example/x",
    "//evil.example",
    "/\\evil.example",
    "me",
    "/login",
    "/login?next=/me",
    "/auth/callback?code=x",
  ])("不安全或會繞圈的 %s 改回預設", (value) => {
    expect(safeNextPath(value)).toBe("/before");
  });

  it("可指定預設", () => {
    expect(safeNextPath(null, "/")).toBe("/");
  });
});

describe("loginRedirectPath", () => {
  it("帶上原路徑與 query", () => {
    expect(loginRedirectPath("/me", "")).toBe("/login?next=%2Fme");
    expect(loginRedirectPath("/say", "?work=abc")).toBe("/login?next=%2Fsay%3Fwork%3Dabc");
  });
});

describe("tasteOnboardingPath", () => {
  it("帶上原本要去的地方", () => {
    expect(tasteOnboardingPath("/before")).toBe("/onboarding/taste?next=%2Fbefore");
    expect(tasteOnboardingPath("/journal?m=2026-10")).toBe("/onboarding/taste?next=%2Fjournal%3Fm%3D2026-10");
  });
  it("外站網址退回預設", () => {
    expect(tasteOnboardingPath("//evil.example")).toBe("/onboarding/taste?next=%2Fbefore");
  });
});
