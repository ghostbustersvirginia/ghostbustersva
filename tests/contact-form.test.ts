import { describe, expect, it } from "vitest";
import {
  shouldShowEventFields,
  isInquirySelectionValid,
  inquiryTypeOptions,
  eventInquiryTypeAllowlist,
} from "../src/lib/contact-form";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

describe("contact form inquiry picker behavior", () => {
  const contactPagePath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../src/pages/contact.astro",
  );
  const styledDropdownPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../src/components/ui/StyledDropdown.astro",
  );
  const contactBookingPanelPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../src/components/contact/ContactBookingPanel.astro",
  );
  const contactPageText = readFileSync(contactPagePath, "utf-8");
  const styledDropdownText = readFileSync(styledDropdownPath, "utf-8");
  const contactBookingPanelText = readFileSync(contactBookingPanelPath, "utf-8");

  it("uses StyledDropdown for required inquiryType", () => {
    expect(contactBookingPanelText).toContain("<StyledDropdown");
    expect(contactBookingPanelText).toContain('id="inquiryType"');
    expect(contactBookingPanelText).toContain('name="inquiryType"');
    expect(contactBookingPanelText).toContain("required");
  });

  it("shows event fields only for allowlisted inquiry types", () => {
    eventInquiryTypeAllowlist.forEach((value) => {
      expect(shouldShowEventFields(value)).toBe(true);
    });

    const nonEventOptions = inquiryTypeOptions.filter(
      (value) => !eventInquiryTypeAllowlist.includes(value),
    );

    nonEventOptions.forEach((value) => {
      expect(shouldShowEventFields(value)).toBe(false);
    });

    expect(shouldShowEventFields("Plan a Proton Pet Drive")).toBe(true);
  });

  it("validates inquiry selection value as required", () => {
    expect(isInquirySelectionValid("Schedule Event")).toBe(true);
    expect(isInquirySelectionValid(" ")).toBe(false);
    expect(isInquirySelectionValid("")).toBe(false);
  });

  it("keeps native select fallback in StyledDropdown and no legacy wrapper marker", () => {
    expect(styledDropdownText).toContain("<select");
    expect(styledDropdownText).toContain("name={name}");
    expect(styledDropdownText).toContain("required={required || undefined}");
    expect(styledDropdownText).toContain(
      '<option value="" disabled selected={!value || undefined}>',
    );
    expect(contactPageText).not.toContain("data-custom-select");
  });

  it("derives page inquiry behavior from the shared allowlist payload", () => {
    expect(contactPageText).toContain("<ContactBookingPanel");
    expect(contactBookingPanelText).toContain(
      "data-event-inquiry-allowlist={eventInquiryAllowlistJson}",
    );
    expect(contactBookingPanelText).toContain("options={inquiryOptions}");
  });
});
