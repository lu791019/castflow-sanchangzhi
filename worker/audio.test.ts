import { execFile } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prepareForGroq } from "./audio.ts";

const execFileAsync = promisify(execFile);

let tmpDir: string;
let sourcePath: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "castflow-audio-test-"));
  sourcePath = path.join(tmpDir, "tone.wav");
  // 10 秒 44.1kHz 雙聲道 wav ≈ 1.7MB，壓成 16kHz 單聲道 32k mp3 約 40KB
  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=10",
    "-ac",
    "2",
    "-ar",
    "44100",
    sourcePath,
  ]);
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("prepareForGroq", () => {
  it("未超過上限 → 原檔直接回傳，不重編碼", async () => {
    const result = await prepareForGroq(sourcePath, { maxBytes: 50 * 1024 * 1024 });
    expect(result).toEqual({ path: sourcePath, compressed: false });
  });

  it("超過上限 → 壓成 16kHz 單聲道 mp3 並落在上限內", async () => {
    const maxBytes = 500 * 1024;
    const result = await prepareForGroq(sourcePath, { maxBytes });
    expect(result.compressed).toBe(true);
    expect(result.path).not.toBe(sourcePath);
    expect(path.extname(result.path)).toBe(".mp3");
    expect((await stat(result.path)).size).toBeLessThanOrEqual(maxBytes);
  });

  it("壓縮後仍超過上限 → 明確丟錯，不靜默截斷", async () => {
    await expect(prepareForGroq(sourcePath, { maxBytes: 1024 })).rejects.toThrow(
      /壓縮後仍超過/,
    );
  });
});
