import { describe, expect, it } from "vitest";
import { shouldShowEventFields, isInquirySelectionValid } from "../src/lib/contact-form";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

describe("contact form inquiry picker behavior", () => {
  const contactPagePath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../src/pages/contact.astro",
  );
  const contactPageText = readFileSync(contactPagePath, "utf-8");

  it("contains a native select control with required inquiryType", () => {
    expect(contactPageText).toContain('<select name="inquiryType" required');
    expect(contactPageText).toContain('option value="" disabled selected');
  });

  it("shows event fields only for Schedule Event", () => {
    expect(shouldShowEventFields("Schedule Event")).toBe(true);
    expect(shouldShowEventFields("General Inquiry")).toBe(false);
    expect(shouldShowEventFields("Other")).toBe(false);
  });

  it("validates inquiry selection value as required", () => {
    expect(isInquirySelectionValid("Schedule Event")).toBe(true);
    expect(isInquirySelectionValid(" ")).toBe(false);
    expect(isInquirySelectionValid("")).toBe(false);
  });

  it("contains keyboard-accessible native select and no custom select wrapper", () => {
    expect(contactPageText).toContain("<select");
    expect(contactPageText).not.toContain("data-custom-select");
  });
});
