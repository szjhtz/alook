import { describe, it, expect } from "vitest"
import { previewSlug } from "./slug-preview"

describe("previewSlug", () => {
  it("flags a changed, non-empty slug for a spaced name", () => {
    expect(previewSlug("My Home")).toEqual({ slug: "My-Home", invalid: false, changed: true })
  })

  it("reports no change for an already-clean name", () => {
    expect(previewSlug("general")).toEqual({ slug: "general", invalid: false, changed: false })
  })

  it("flags invalid for an all-disallowed-characters input", () => {
    expect(previewSlug("///")).toEqual({ slug: "", invalid: true, changed: false })
  })

  it("does not flag invalid for an empty or whitespace-only (untouched) input", () => {
    expect(previewSlug("")).toEqual({ slug: "", invalid: false, changed: false })
    expect(previewSlug("   ")).toEqual({ slug: "", invalid: false, changed: false })
  })
})
