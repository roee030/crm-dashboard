import dns from "dns/promises";
import net from "net";

/**
 * True if an IP literal is in a private / loopback / link-local / reserved range
 * (IPv4 or IPv6). Pure and synchronous — safe to unit-test.
 */
export function isPrivateIp(ip: string): boolean {
  const type = net.isIP(ip);
  if (type === 4) return isPrivateIpv4(ip);
  if (type === 6) return isPrivateIpv6(ip);
  return true; // not a valid IP → treat as unsafe
}

function isPrivateIpv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const addr = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (addr === "::1" || addr === "::") return true; // loopback / unspecified
  if (addr.startsWith("fe80")) return true; // link-local
  if (addr.startsWith("fc") || addr.startsWith("fd")) return true; // unique local fc00::/7
  // IPv4-mapped / -compatible, anchored to the whole address to avoid a parser
  // differential (::ffff:a.b.c.d / ::ffff:0:a.b.c.d / ::a.b.c.d) → check IPv4 part.
  const mapped = addr.match(/^::(?:ffff:(?:0:)?)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  // Fail closed: only 2000::/3 global unicast is treated as public; everything
  // else (documentation, ULA variants, unknown forms) is blocked.
  const firstHextet = parseInt(addr.split(":")[0] || "0", 16);
  if (Number.isNaN(firstHextet)) return true;
  return !(firstHextet >= 0x2000 && firstHextet <= 0x3fff);
}

/**
 * True only if the URL is http(s), has a hostname that is not an obvious local
 * name, and every resolved IP is public. Blocks SSRF to loopback / metadata /
 * private ranges. Fails closed on any error.
 */
export async function isPublicHttpUrl(raw: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return false;
  }

  // IP literal → check directly, no DNS.
  if (net.isIP(host)) return !isPrivateIp(host);

  // Hostname → resolve and ensure every address is public.
  try {
    const records = await dns.lookup(host, { all: true });
    if (records.length === 0) return false;
    return records.every((r) => !isPrivateIp(r.address));
  } catch {
    return false;
  }
}
