import { describe, expect, it, vi } from "vitest";
import { signStoredAudioUrl } from "./signed-url";

const STORED = "http://127.0.0.1:54321/storage/v1/object/public/audio/episodes/u1/1700000000000-say.webm";

function fakeClient(result: { data: { signedUrl: string } | null; error: { message: string } | null }) {
  const createSignedUrl = vi.fn(async () => result);
  const from = vi.fn(() => ({ createSignedUrl }));
  return { client: { storage: { from } } as never, from, createSignedUrl };
}

describe("signStoredAudioUrl", () => {
  it("自家錄音 → 以儲存路徑簽名", async () => {
    const { client, from, createSignedUrl } = fakeClient({ data: { signedUrl: "https://signed/x?token=t" }, error: null });
    await expect(signStoredAudioUrl(client, STORED, 600)).resolves.toBe("https://signed/x?token=t");
    expect(from).toHaveBeenCalledWith("audio");
    expect(createSignedUrl).toHaveBeenCalledWith("episodes/u1/1700000000000-say.webm", 600);
  });

  it("外部網址（RSS）原樣回傳，不呼叫 storage", async () => {
    const { client, from } = fakeClient({ data: null, error: null });
    await expect(signStoredAudioUrl(client, "https://cdn.example/ep.mp3", 600)).resolves.toBe(
      "https://cdn.example/ep.mp3",
    );
    expect(from).not.toHaveBeenCalled();
  });

  it("簽發失敗 → 丟錯", async () => {
    const { client } = fakeClient({ data: null, error: { message: "Object not found" } });
    await expect(signStoredAudioUrl(client, STORED, 600)).rejects.toThrow("Object not found");
  });
});
