import { describe, expect, it } from "vitest";
import { logResumePath } from "@/lib/journal/log-draft";
import { resumeLoginPath } from "@/lib/say/draft";
import { loginContextNote } from "./login-context";

const nextOf = (loginPath: string) => decodeURIComponent(loginPath.split("next=")[1]);

describe("loginContextNote（登入頁依來源補一句，UX-03）", () => {
  it("記一筆填到一半來登入：告訴他剛剛填的會留著", () => {
    expect(loginContextNote(nextOf(logResumePath()))).toBe("剛剛記一筆填的會先留著，登入後接著記。");
  });

  it("說一段送出前來登入：剛剛說的／寫的會留著", () => {
    expect(loginContextNote(nextOf(resumeLoginPath()))).toBe("剛剛說的、寫的會先留著，登入後接著整理。");
  });

  it("其他來源不加", () => {
    expect(loginContextNote("/me")).toBeNull();
    expect(loginContextNote("/journal/new")).toBeNull();
  });
});
