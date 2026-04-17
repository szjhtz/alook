import { describe, it, expect } from "vitest";
import { isTypingTarget } from "./keyboard";

function mkEl(tag: string, contentEditable = false): HTMLElement {
  return {
    tagName: tag.toUpperCase(),
    isContentEditable: contentEditable,
  } as unknown as HTMLElement;
}

describe("isTypingTarget", () => {
  it("true for INPUT / TEXTAREA / SELECT", () => {
    expect(isTypingTarget(mkEl("input"))).toBe(true);
    expect(isTypingTarget(mkEl("textarea"))).toBe(true);
    expect(isTypingTarget(mkEl("select"))).toBe(true);
  });

  it("true for contenteditable elements", () => {
    expect(isTypingTarget(mkEl("div", true))).toBe(true);
  });

  it("false for buttons, divs, spans without contenteditable", () => {
    expect(isTypingTarget(mkEl("button"))).toBe(false);
    expect(isTypingTarget(mkEl("div"))).toBe(false);
    expect(isTypingTarget(mkEl("span"))).toBe(false);
  });

  it("false for null / missing target", () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget({} as unknown as EventTarget)).toBe(false);
  });
});
