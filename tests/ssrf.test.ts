import { describe, it, expect } from "vitest";
import { isPrivateIp, isPublicHttpUrl } from "@/lib/net/ssrf";

describe("isPrivateIp (IPv4)", () => {
  it("flags private / loopback / metadata ranges", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.5", "172.16.9.9", "169.254.169.254", "0.0.0.0", "100.64.0.1"]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });
  it("allows public IPv4", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "203.0.113.10"]) {
      expect(isPrivateIp(ip)).toBe(false);
    }
  });
});

describe("isPrivateIp (IPv6)", () => {
  it("flags loopback, link-local, ULA, and IPv4-mapped private", () => {
    for (const ip of ["::1", "fe80::1", "fc00::1", "fd12::3", "::ffff:127.0.0.1", "::ffff:10.0.0.1"]) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });
  it("allows 2000::/3 global unicast", () => {
    expect(isPrivateIp("2606:4700:4700::1111")).toBe(false);
  });
  it("fails closed on unknown/non-global forms", () => {
    expect(isPrivateIp("fe00::1")).toBe(true);
    expect(isPrivateIp("not-an-ip")).toBe(true);
  });
});

describe("isPublicHttpUrl", () => {
  it("rejects non-http protocols", async () => {
    expect(await isPublicHttpUrl("ftp://8.8.8.8")).toBe(false);
    expect(await isPublicHttpUrl("file:///etc/passwd")).toBe(false);
  });
  it("rejects localhost and private IP literals", async () => {
    expect(await isPublicHttpUrl("http://localhost/x")).toBe(false);
    expect(await isPublicHttpUrl("http://127.0.0.1:8080")).toBe(false);
    expect(await isPublicHttpUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(await isPublicHttpUrl("http://[::1]/")).toBe(false);
  });
  it("accepts a public IP literal", async () => {
    expect(await isPublicHttpUrl("https://1.1.1.1/webhook")).toBe(true);
  });
  it("rejects garbage", async () => {
    expect(await isPublicHttpUrl("not a url")).toBe(false);
  });
});
