import { afterEach, describe, expect, it } from "vitest";
import { claudeCliArgs } from "./client";

describe("claudeCliArgs：claude CLI 預設帶 --safe-mode（不載入 CLAUDE.md、skills、hooks、MCP、auto memory）", () => {
  afterEach(() => {
    delete process.env.CLAUDE_CLI_SAFE_MODE;
  });

  it("未設定環境變數：預設開 safe mode", () => {
    expect(claudeCliArgs()).toEqual(["--safe-mode", "--print"]);
  });

  it("CLAUDE_CLI_SAFE_MODE=0：關掉，只帶 --print", () => {
    process.env.CLAUDE_CLI_SAFE_MODE = "0";
    expect(claudeCliArgs()).toEqual(["--print"]);
  });

  it("其他值（例如 1）一律視為開", () => {
    process.env.CLAUDE_CLI_SAFE_MODE = "1";
    expect(claudeCliArgs()).toEqual(["--safe-mode", "--print"]);
  });
});
