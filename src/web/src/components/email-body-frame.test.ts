import { describe, it, expect } from "vitest";
import { buildSrcDoc } from "./email-body-frame";

describe("buildSrcDoc", () => {
  const sampleHtml = '<p style="color: #000;">Hello world</p>';

  it("wraps HTML in a full document", () => {
    const doc = buildSrcDoc(sampleHtml, false);
    expect(doc).toContain("<!DOCTYPE html>");
    expect(doc).toContain("<body>");
    expect(doc).toContain(sampleHtml);
  });

  it("injects light mode styles by default", () => {
    const doc = buildSrcDoc(sampleHtml, false);
    expect(doc).toContain('name="color-scheme" content="light"');
    expect(doc).toContain("color: #1a1a1a");
    expect(doc).not.toContain("color-scheme: dark");
  });

  it("injects dark mode styles when isDark is true", () => {
    const doc = buildSrcDoc(sampleHtml, true);
    expect(doc).toContain('name="color-scheme" content="dark"');
    expect(doc).toContain("color-scheme: dark");
    expect(doc).toContain("color: #e8e5e0");
    expect(doc).toContain("background-color: transparent !important");
  });

  it("forces text color with !important in dark mode", () => {
    const doc = buildSrcDoc(sampleHtml, true);
    expect(doc).toContain("color: #e8e5e0 !important");
  });

  it("sets max-width on images to prevent overflow", () => {
    const imgHtml = '<img src="photo.jpg" width="2000">';
    const doc = buildSrcDoc(imgHtml, false);
    expect(doc).toContain("max-width: 100%");
  });

  it("preserves the original HTML content unchanged", () => {
    const complexHtml = '<table><tr><td style="background:#fff;color:#000">Cell</td></tr></table>';
    const doc = buildSrcDoc(complexHtml, true);
    expect(doc).toContain(complexHtml);
  });
});
