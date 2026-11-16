import { describe, expect, it } from "vitest";
import { penNameStatus } from "./pen-name-status";

describe("penNameStatus", () => {
  it("空白：提示字數、不能送", () => {
    expect(penNameStatus("  ", "available")).toEqual({
      text: "最多 20 個字，中文、英文都可以。",
      tone: "hint",
      ready: false,
      buttonLabel: "先寫一個筆名",
    });
  });

  it("檢查中：主鈕跟著說在查（UX-20）", () => {
    expect(penNameStatus("林小晴", "checking")).toMatchObject({
      text: "查一下有沒有人用……",
      ready: false,
      buttonLabel: "查一下有沒有人用",
    });
  });

  it("可用：粗字 + 就用這個", () => {
    expect(penNameStatus(" 林小晴 ", "available")).toEqual({
      text: "這個筆名還沒人用",
      tone: "ok",
      ready: true,
      buttonLabel: "就用這個",
    });
  });

  it("有人用：只說事實與下一步", () => {
    expect(penNameStatus("阿哲", "taken")).toMatchObject({
      text: "「阿哲」已經有人用了。加一個字試試？",
      ready: false,
      buttonLabel: "換一個筆名",
    });
  });

  it("查不到：仍可送出（server 會再擋）", () => {
    expect(penNameStatus("林小晴", "unknown")).toMatchObject({ ready: true, buttonLabel: "就用這個" });
  });

  it("超過 20 字：沿用既有規則的錯誤訊息，主鈕請他改短（UX-20）", () => {
    expect(penNameStatus("字".repeat(21), "available")).toMatchObject({
      text: "筆名最多 20 個字",
      ready: false,
      buttonLabel: "改短一點",
    });
  });

  it("有控制字元：主鈕請他改一下", () => {
    expect(penNameStatus("林\u0007小晴", "available")).toMatchObject({ ready: false, buttonLabel: "改一下筆名" });
  });

  it("跟現在的筆名一樣：不查、不能送（UX-20）", () => {
    expect(penNameStatus(" 林小晴 ", "available", "林小晴")).toEqual({
      text: "這是你現在的筆名",
      tone: "hint",
      ready: false,
      buttonLabel: "這是你現在的筆名",
      unchanged: true,
    });
    expect(penNameStatus("林小晴", "checking", "林小晴")).toMatchObject({ unchanged: true });
  });

  it("改成別的名字：照常檢查", () => {
    expect(penNameStatus("林小雨", "available", "林小晴")).toMatchObject({ ready: true, buttonLabel: "就用這個" });
    expect(penNameStatus("林小雨", "available", "林小晴").unchanged).toBeUndefined();
  });
});
