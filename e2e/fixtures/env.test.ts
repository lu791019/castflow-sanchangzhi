import { describe, expect, it } from "vitest";
import { assertAllowedSupabaseUrl, projectRefOf } from "./env";

const REF = "abcdefghijklmnopqrst";
const REMOTE = `https://${REF}.supabase.co/`;

describe("assertAllowedSupabaseUrl", () => {
  it("本地一律放行（去掉結尾斜線）", () => {
    expect(assertAllowedSupabaseUrl("http://127.0.0.1:54321/", undefined)).toBe("http://127.0.0.1:54321");
    expect(assertAllowedSupabaseUrl("http://localhost:54321", undefined)).toBe("http://localhost:54321");
  });

  it("雲端沒設 E2E_REMOTE_REF 拒絕", () => {
    expect(() => assertAllowedSupabaseUrl(REMOTE, undefined)).toThrow(/E2E_REMOTE_REF/);
    expect(() => assertAllowedSupabaseUrl(REMOTE, "")).toThrow(/E2E_REMOTE_REF/);
  });

  it("雲端 E2E_REMOTE_REF 對不上拒絕", () => {
    expect(() => assertAllowedSupabaseUrl(REMOTE, "zzzzzzzzzzzzzzzzzzzz")).toThrow(/E2E_REMOTE_REF/);
  });

  it("雲端 E2E_REMOTE_REF 等於 project ref 才放行", () => {
    expect(assertAllowedSupabaseUrl(REMOTE, REF)).toBe(`https://${REF}.supabase.co`);
  });

  it("不是本地也不是 <ref>.supabase.co 一律拒絕", () => {
    expect(() => assertAllowedSupabaseUrl("https://db.example.com", REF)).toThrow(/拒絕/);
    expect(() => assertAllowedSupabaseUrl(`https://${REF}.supabase.co.evil.com`, REF)).toThrow(/拒絕/);
  });

  it("projectRefOf 只認 <20 碼>.supabase.co", () => {
    expect(projectRefOf(REMOTE)).toBe(REF);
    expect(projectRefOf("http://127.0.0.1:54321")).toBeNull();
  });
});
