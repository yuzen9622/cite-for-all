// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { sanitizeHtml } from "@/lib/sanitize-html"

describe("sanitizeHtml", () => {
  it("keeps italic and leetcode-style markup, stripping attributes", () => {
    const out = sanitizeHtml(
      '<div data-x="1"><i class="evil">IEEE Trans. Educ.</i> <sub>2</sub> <sup>3</sup></div>',
    )
    expect(out).not.toContain("data-x")
    expect(out).not.toContain("class")
    expect(out).toContain("<i>IEEE Trans. Educ.</i>")
    expect(out).toContain("<sub>2</sub>")
    expect(out).toContain("<sup>3</sup>")
  })

  it("removes event handler attributes from span (XSS regression)", () => {
    const out = sanitizeHtml(
      '<span onmouseover="alert(1)" onclick="alert(2)" style="font-variant:small-caps">x</span>',
    )
    expect(out).not.toContain("onmouseover")
    expect(out).not.toContain("onclick")
    expect(out).toContain("font-variant:small-caps")
  })

  it("drops style values that smuggle CSS along with font-variant", () => {
    const out = sanitizeHtml(
      '<span style="font-variant:small-caps;background:url(javascript:alert(1))">x</span>',
    )
    expect(out).not.toContain("background")
    expect(out).not.toContain("javascript")
  })

  it("drops any style other than an exact small-caps declaration", () => {
    expect(sanitizeHtml('<span style="color:red">x</span>')).toBe(
      "<span>x</span>",
    )
    expect(
      sanitizeHtml('<span style="font-variant: small-caps">x</span>'),
    ).toContain("font-variant: small-caps")
    expect(sanitizeHtml('<span style="font-variant:normal">x</span>')).toBe(
      "<span>x</span>",
    )
  })

  it("unwraps scripts and unrecognized elements, keeping their text", () => {
    const out = sanitizeHtml(
      '<script>alert(1)</script><p onclick="bad()">hello <b>world</b></p>',
    )
    expect(out).not.toContain("<script>")
    expect(out).not.toContain("<p")
    expect(out).not.toContain("onclick")
    expect(out).toContain("hello <b>world</b>")
  })

  it("keeps plain text untouched", () => {
    expect(sanitizeHtml("plain text")).toBe("plain text")
  })
})
