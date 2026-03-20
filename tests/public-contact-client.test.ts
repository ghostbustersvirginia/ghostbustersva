import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import vm from "vm";

describe("public contact-form client", () => {
  const filePath = path.resolve(__dirname, "..", "public", "contact-form-client.js");
  const fileText = fs.readFileSync(filePath, "utf-8");

  // Minimal fake DOM primitives to exercise the module without jsdom.
  function createFakeElement() {
    const listeners: Record<string, Function[]> = {};
    return {
      value: "",
      hidden: true,
      _flatpickr: undefined,
      addEventListener(type: string, handler: Function) {
        listeners[type] = listeners[type] || [];
        listeners[type].push(handler);
      },
      dispatchEvent(event: any) {
        const fns = listeners[event.type] || [];
        for (const fn of fns) fn.call(this, Object.assign({}, event, { target: this }));
      },
      closest() {
        return null;
      },
      querySelector() {
        return null;
      },
    } as any;
  }

  it("smoke: shipped script parses and exposes initContactForm", () => {
    const stubbed = fileText.replace(/import\s+flatpickr[\s\S]*?;\n/, `const flatpickr = (el, opts) => ({
      selectedDates: [],
      set: () => {},
      clear: () => {},
      parseDate: () => null,
      open: () => {},
    });\n`);

    const fakeDoc: any = {
      querySelector(selector: string) {
        return null;
      },
      querySelectorAll(selector: string) {
        return [];
      },
    };

    const stubFlatpickr = (el: any, opts: any) => ({
      selectedDates: [],
      set: () => {},
      clear: () => {},
      parseDate: () => null,
      open: () => {},
    });

    const context: any = { document: fakeDoc, window: { flatpickr: stubFlatpickr }, Event: function Event(t: string, opts?: any) { return { type: t, ...opts }; } };
    const result = vm.runInNewContext(stubbed + "\n; typeof initContactForm === 'function';", context);

    expect(result).toBe(true);
  });

  it("interaction: selecting 'Schedule Event' unhides event fields", () => {
    const stubbed = fileText.replace(/import\s+flatpickr[\s\S]*?;\n/, `const flatpickr = (el, opts) => ({
      selectedDates: [],
      set: () => {},
      clear: () => {},
      parseDate: () => null,
      open: () => {},
    });\n`);

    // Build a minimal document mapping that the script will query
    const inquirySelect = createFakeElement();
    const dateInput = createFakeElement();
    const dateEndInput = createFakeElement();

    const eventField1 = createFakeElement();
    const eventField2 = createFakeElement();

    const fakeDoc: any = {
      querySelector(selector: string) {
        switch (selector) {
          case "select[name='inquiryType']":
            return inquirySelect;
          case "[data-date-input]":
            return dateInput;
          case "[data-date-end-input]":
            return dateEndInput;
          case ".contact-form__status":
            return { textContent: "" };
          default:
            return null;
        }
      },
      querySelectorAll(selector: string) {
        switch (selector) {
          case "[data-date-clear]":
            return [];
          case "[data-event-field]":
            return [eventField1, eventField2];
          case "[data-event-input]":
            return [];
          case "[data-event-optional-input]":
            return [];
          default:
            return [];
        }
      },
    };

    const stubFlatpickr = (el: any, opts: any) => ({
      selectedDates: [],
      set: () => {},
      clear: () => {},
      parseDate: () => null,
      open: () => {},
    });

    const context: any = { document: fakeDoc, window: { flatpickr: stubFlatpickr }, Event: function Event(t: string, opts?: any) { return { type: t, ...opts }; } };
    const initContactForm = vm.runInNewContext(stubbed + "\n; initContactForm;", context);

    // initialize
    initContactForm();

    // initially hidden
    expect(eventField1.hidden).toBe(true);
    expect(eventField2.hidden).toBe(true);

    // simulate selecting Schedule Event
    inquirySelect.value = "Schedule Event";
    inquirySelect.dispatchEvent({ type: "change", bubbles: true });

    expect(eventField1.hidden).toBe(false);
    expect(eventField2.hidden).toBe(false);
  });
});
