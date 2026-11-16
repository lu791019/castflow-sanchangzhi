import { describe, expect, it } from "vitest";
import { isBlockedHostname, isPrivateAddress, nextRedirectUrl, parseRemoteCoverUrl } from "./remote-url";

describe("parseRemoteCoverUrl", () => {
  it("收 https 網址", () => {
    const result = parseRemoteCoverUrl(" https://image.tmdb.org/t/p/w500/a.jpg ");
    expect(result.ok && result.value.href).toBe("https://image.tmdb.org/t/p/w500/a.jpg");
  });

  it("擋 http、data:、javascript:、壞網址", () => {
    for (const value of ["http://example.com/a.jpg", "data:image/png;base64,AAA", "javascript:alert(1)", "https://", "不是網址"]) {
      expect(parseRemoteCoverUrl(value).ok).toBe(false);
    }
  });

  it("擋帶帳密與非 443 埠", () => {
    expect(parseRemoteCoverUrl("https://user:pw@example.com/a.jpg").ok).toBe(false);
    expect(parseRemoteCoverUrl("https://example.com:8443/a.jpg").ok).toBe(false);
    expect(parseRemoteCoverUrl("https://example.com:443/a.jpg").ok).toBe(true);
  });

  it("擋 localhost 與私有網段的 IP 字面", () => {
    for (const value of [
      "https://localhost/a.jpg",
      "https://foo.localhost/a.jpg",
      "https://127.0.0.1/a.jpg",
      "https://10.0.0.5/a.jpg",
      "https://192.168.1.1/a.jpg",
      "https://169.254.169.254/latest/meta-data",
      "https://[::1]/a.jpg",
      "https://metadata.google.internal/a.jpg",
    ]) {
      expect(parseRemoteCoverUrl(value).ok).toBe(false);
    }
  });

  it("太長的網址不收", () => {
    expect(parseRemoteCoverUrl(`https://example.com/${"a".repeat(2100)}`).ok).toBe(false);
  });
});

describe("isPrivateAddress", () => {
  it("IPv4 私有、迴路、link-local、CGNAT、保留段都擋", () => {
    for (const ip of [
      "0.0.0.0",
      "10.1.2.3",
      "100.64.0.1",
      "127.0.0.1",
      "169.254.169.254",
      "172.16.0.1",
      "172.31.255.255",
      "192.0.0.1",
      "192.168.0.1",
      "198.18.0.1",
      "224.0.0.1",
      "255.255.255.255",
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it("IPv4 公網放行", () => {
    for (const ip of ["8.8.8.8", "172.32.0.1", "104.18.1.1", "13.32.1.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it("IPv6 迴路、ULA、link-local、IPv4 對映都擋", () => {
    for (const ip of ["::", "::1", "fc00::1", "fd12:3456::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "ff02::1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it("IPv6 公網放行", () => {
    expect(isPrivateAddress("2606:4700::6810:1")).toBe(false);
    expect(isPrivateAddress("::ffff:8.8.8.8")).toBe(false);
  });

  it("不是 IP 的字串一律當危險", () => {
    expect(isPrivateAddress("example.com")).toBe(true);
  });
});

describe("isBlockedHostname", () => {
  it("擋 localhost、.local、.internal、私網 IP 字面", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isBlockedHostname("printer.local")).toBe(true);
    expect(isBlockedHostname("metadata.google.internal")).toBe(true);
    expect(isBlockedHostname("[::1]")).toBe(true);
    expect(isBlockedHostname("10.0.0.1")).toBe(true);
  });

  it("一般網域放行", () => {
    expect(isBlockedHostname("image.tmdb.org")).toBe(false);
    expect(isBlockedHostname("8.8.8.8")).toBe(false);
  });
});

describe("nextRedirectUrl", () => {
  const from = new URL("https://image.tmdb.org/t/p/a.jpg");

  it("相對路徑以目前網址為基準", () => {
    const result = nextRedirectUrl(from, "/t/p/b.jpg");
    expect(result.ok && result.value.href).toBe("https://image.tmdb.org/t/p/b.jpg");
  });

  it("每一跳重驗：轉去 http 或內網都擋", () => {
    expect(nextRedirectUrl(from, "http://image.tmdb.org/a.jpg").ok).toBe(false);
    expect(nextRedirectUrl(from, "https://169.254.169.254/").ok).toBe(false);
    expect(nextRedirectUrl(from, null).ok).toBe(false);
  });
});
