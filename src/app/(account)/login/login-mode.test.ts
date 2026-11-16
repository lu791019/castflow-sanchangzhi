import { describe, expect, it } from "vitest";
import { LOGIN_COPY, loginMode, LOGIN_START_STEP } from "./login-mode";

describe("loginMode（登入頁依來源換標題，UX-12）", () => {
  it("從記一筆、說一段、我的被擋下來 → 新人：開一個專欄", () => {
    expect(loginMode({ next: "/journal/new?resume=1" })).toBe("start");
    expect(loginMode({ next: "/journal" })).toBe("start");
    expect(loginMode({ next: "/say?resume=1" })).toBe("start");
    expect(loginMode({ next: "/me" })).toBe("start");
    expect(loginMode({ next: "/me/settings" })).toBe("start");
  });

  it("封面「用 email 開始」→ 新人", () => {
    expect(loginMode({ next: "/", step: LOGIN_START_STEP })).toBe("start");
  });

  it("封面「用 email 找回來」、其他頁、連結失效 → 找回", () => {
    expect(loginMode({ next: "/", step: "mail" })).toBe("recover");
    expect(loginMode({ next: "/s/abc" })).toBe("recover");
    expect(loginMode({ next: "/" })).toBe("recover");
    expect(loginMode({ next: "/me", linkFailed: true })).toBe("recover");
  });

  it("前綴相似但不是那幾頁 → 找回", () => {
    expect(loginMode({ next: "/members" })).toBe("recover");
    expect(loginMode({ next: "/sayings" })).toBe("recover");
  });
});

describe("LOGIN_COPY", () => {
  it("新人：標題「用 email 開一個專欄」，也告訴有專欄的人同一個 email 會回到原本那個", () => {
    expect(LOGIN_COPY.start.heading.join("")).toContain("用 email 開一個專欄");
    expect(LOGIN_COPY.start.note).toContain("同一個 email");
  });

  it("找回：維持原文案", () => {
    expect(LOGIN_COPY.recover.title).toBe("找回專欄");
    expect(LOGIN_COPY.recover.heading).toEqual(["用 email 收一個連結，", "下次在任何裝置都找得到你的專欄。"]);
  });
});
