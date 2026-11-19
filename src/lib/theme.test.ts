import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { theme } from "./theme";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function cssColour(name: string) {
  const kebab = name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  return css.match(new RegExp(`--color-${kebab}:\\s*(#[0-9a-f]{6})`, "i"))?.[1]?.toLowerCase();
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("theme", () => {
  it("matches the @theme block in globals.css", () => {
    for (const [name, value] of Object.entries(theme)) {
      expect(cssColour(name), name).toBe(value);
    }
  });

  const backgrounds = { ground: theme.ground, panel: theme.panel, stripe: theme.stripe };

  it("text colours pass WCAG AA (4.5:1) on every surface", () => {
    const text = {
      ink: theme.ink,
      muted: theme.muted,
      accentText: theme.accentText,
      statusOnTimeText: theme.statusOnTimeText,
      statusTightText: theme.statusTightText,
      statusLateText: theme.statusLateText,
    };
    for (const [t, fg] of Object.entries(text)) {
      for (const [b, bg] of Object.entries(backgrounds)) {
        expect(contrast(fg, bg), `${t} on ${b}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("dark text passes AA on the critical yellow and the orange accent", () => {
    expect(contrast(theme.criticalInk, theme.critical)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.ink, theme.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.ink, theme.accentHover)).toBeGreaterThanOrEqual(4.5);
  });

  it("category colours and control outlines reach 3:1 on every surface", () => {
    const graphics = Object.entries(theme).filter(
      ([name]) => name.startsWith("cat") || name === "control",
    );
    for (const [g, fg] of graphics) {
      for (const [b, bg] of Object.entries(backgrounds)) {
        expect(contrast(fg, bg), `${g} on ${b}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
