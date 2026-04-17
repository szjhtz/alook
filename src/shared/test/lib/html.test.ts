import { describe, it, expect } from "vitest";
import { isEmptyHtml } from "../../src/lib/html";

describe("isEmptyHtml", () => {
  it("returns true for blank / placeholder-editor shapes", () => {
    for (const v of [
      "",
      "<p></p>",
      "<p><br></p>",
      "  <p> </p>  ",
      "<p>\n</p>",
      "<p><br/></p>",
      "<p><br /></p>",
      "<p>&nbsp;</p>",
    ]) {
      expect(isEmptyHtml(v)).toBe(true);
    }
  });

  it("returns true for null / undefined", () => {
    expect(isEmptyHtml(null)).toBe(true);
    expect(isEmptyHtml(undefined)).toBe(true);
  });

  it("returns false for real content", () => {
    for (const v of [
      "<p>hi</p>",
      "<p> a </p>",
      "<h1>t</h1>",
      "<ul><li>x</li></ul>",
    ]) {
      expect(isEmptyHtml(v)).toBe(false);
    }
  });
});
