import { describe, it, expect } from "vitest";
import { csvEscape, toCsv } from "@/lib/csv";

describe("csvEscape", () => {
  it("passes plain values through", () => {
    expect(csvEscape("hello")).toBe("hello");
    expect(csvEscape(42)).toBe("42");
    expect(csvEscape(null)).toBe("");
  });
  it("quotes values with commas, quotes, or newlines", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('she said "hi"')).toBe('"she said ""hi"""');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });
  it("neutralizes spreadsheet formula injection", () => {
    expect(csvEscape("=1+1")).toBe("'=1+1");
    expect(csvEscape("+ping")).toBe("'+ping");
    expect(csvEscape("-2")).toBe("'-2");
    expect(csvEscape("@cmd")).toBe("'@cmd");
  });
  it("preserves Hebrew content", () => {
    expect(csvEscape("שלום")).toBe("שלום");
  });
});

describe("toCsv", () => {
  it("builds a header + rows with CRLF line endings", () => {
    const csv = toCsv(["a", "b"], [[1, "x,y"], [2, "z"]]);
    expect(csv).toBe('a,b\r\n1,"x,y"\r\n2,z');
  });
});
