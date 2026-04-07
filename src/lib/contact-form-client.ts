import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import { shouldShowEventFields } from "./contact-form";

export function initContactForm() {
  if (typeof document === "undefined") {
    return;
  }

  const inquirySelect = document.querySelector<HTMLSelectElement>("select[name='inquiryType']");
  const dateInput = document.querySelector<HTMLInputElement>("[data-date-input]");
  const dateEndInput = document.querySelector<HTMLInputElement>("[data-date-end-input]");

  if (!inquirySelect || !dateInput || !dateEndInput) {
    console.warn("initContactForm: missing contact form elements", {
      inquirySelect,
      dateInput,
      dateEndInput,
    });
    return;
  }

  const dateClearButtons = document.querySelectorAll<HTMLButtonElement>("[data-date-clear]");
  const eventFieldRows = document.querySelectorAll<HTMLElement>("[data-event-field]");
  const eventRequiredInputs = document.querySelectorAll<HTMLInputElement>("[data-event-input]");
  const eventOptionalInputs = document.querySelectorAll<HTMLInputElement>(
    "[data-event-optional-input]",
  );

  const syncDateClearButtons = () => {
    dateClearButtons.forEach((button) => {
      const wrapper = button.closest<HTMLElement>(".contact-form__date-input-wrap");
      const input = wrapper?.querySelector<HTMLInputElement>("input");

      if (!input) {
        return;
      }

      button.hidden = !input.value || input.disabled;
    });
  };

  const dateStatus = document.querySelector<HTMLElement>(".contact-form__status");

  const announceDate = (message: string) => {
    if (dateStatus) {
      dateStatus.textContent = message;
    }
  };

  const setEventFieldsVisibility = (selectedValue: string) => {
    const normalizedValue = (selectedValue || "").trim();
    const showEventFields = shouldShowEventFields(normalizedValue);

    if (process.env.NODE_ENV !== "production") {
      console.debug("setEventFieldsVisibility", {
        selectedValue: normalizedValue,
        showEventFields,
      });
    }

    eventFieldRows.forEach((field) => {
      field.hidden = !showEventFields;
    });

    eventRequiredInputs.forEach((input) => {
      input.required = showEventFields;
      input.disabled = !showEventFields;

      if (!showEventFields) {
        input.value = "";
      }
    });

    eventOptionalInputs.forEach((input) => {
      input.required = false;
      input.disabled = !showEventFields;

      if (!showEventFields) {
        input.value = "";
      }
    });

    syncDateClearButtons();
  };

  const initializeInquirySelect = () => {
    const selectedValue = inquirySelect?.value ?? "";

    setEventFieldsVisibility(selectedValue);

    inquirySelect?.addEventListener("change", (event) => {
      const value = (event.target as HTMLSelectElement).value;
      setEventFieldsVisibility(value);
    });
  };

  initializeInquirySelect();

  try {
    if (dateInput) {
      let endDatePicker: any = null;

      const startDatePicker = flatpickr(dateInput, {
        dateFormat: "m/d/Y",
        disableMobile: true,
        allowInput: true,
        clickOpens: true,
        position: "below right",
        monthSelectorType: "static",
        minDate: "today",
        appendTo: document.body,
        onOpen: () => {
          try {
            if (endDatePicker && typeof endDatePicker.close === "function") {
              endDatePicker.close();
            }
          } catch (err) {
            /* ignore */
          }
        },
        onValueUpdate: () => {
          syncDateClearButtons();
        },
        onChange: (selectedDates) => {
          const selectedStartDate = selectedDates[0];

          if (selectedStartDate) {
            announceDate(`Start date set to ${dateInput.value}`);
          } else {
            announceDate("Start date cleared");
          }

          if (!endDatePicker) {
            return;
          }

          endDatePicker.set("minDate", selectedStartDate ?? "today");

          if (selectedStartDate && dateEndInput?.value) {
            const parsedEndDate = endDatePicker.parseDate(dateEndInput.value, "m/d/Y");

            if (parsedEndDate && parsedEndDate < selectedStartDate) {
              endDatePicker.clear();
            }
          }

          syncDateClearButtons();
        },
      });

      if (dateEndInput) {
        endDatePicker = flatpickr(dateEndInput, {
          dateFormat: "m/d/Y",
          disableMobile: true,
          allowInput: true,
          clickOpens: true,
          position: "below right",
          monthSelectorType: "static",
          minDate: "today",
          appendTo: document.body,
          onOpen: () => {
            try {
              if (startDatePicker && typeof startDatePicker.close === "function") {
                startDatePicker.close();
              }
            } catch (err) {
              /* ignore */
            }
          },
          onValueUpdate: () => {
            syncDateClearButtons();
          },
          onChange: (selectedDates) => {
            const selectedEndDate = selectedDates[0];

            if (selectedEndDate) {
              announceDate(`End date set to ${dateEndInput.value}`);
            } else {
              announceDate("End date cleared");
            }

            syncDateClearButtons();
          },
        });

        const selectedStartDate = startDatePicker.selectedDates[0];

        if (selectedStartDate) {
          endDatePicker.set("minDate", selectedStartDate);
        }

        dateEndInput.addEventListener("focus", () => {
          endDatePicker?.open();
        });
      }

      dateInput.addEventListener("focus", () => {
        startDatePicker.open();
      });

      // Close pickers when clicking outside inputs/calendars
      const clickOutsideHandler = (ev: Event) => {
        try {
          const target = ev.target as Node;
          const calendars = Array.from(
            document.querySelectorAll(".flatpickr-calendar"),
          ) as Element[];
          const clickedInCalendar = calendars.some((c) => c.contains(target));
          const clickedInInput =
            (dateInput &&
              (dateInput === target || (dateInput.contains && dateInput.contains(target)))) ||
            (dateEndInput &&
              (dateEndInput === target ||
                (dateEndInput.contains && dateEndInput.contains(target))));

          if (!clickedInCalendar && !clickedInInput) {
            try {
              (startDatePicker as any)?.close?.();
            } catch (e) {
              /* ignore */
            }
            try {
              (endDatePicker as any)?.close?.();
            } catch (e) {
              /* ignore */
            }
          }
        } catch (err) {
          /* ignore */
        }
      };

      document.addEventListener("click", clickOutsideHandler);
    }
  } catch (err) {
    console.warn("flatpickr init failed:", err);
  }

  try {
    dateClearButtons.forEach((button) => {
      const wrapper = button.closest<HTMLElement>(".contact-form__date-input-wrap");
      const input = wrapper?.querySelector<HTMLInputElement>("input");

      if (!input) {
        return;
      }

      const syncForInput = () => {
        button.hidden = !input.value || input.disabled;
      };

      button.addEventListener("click", () => {
        const pickerInstance = (input as HTMLInputElement & { _flatpickr?: { clear: () => void } })
          ._flatpickr;

        if (pickerInstance) {
          pickerInstance.clear();
        } else {
          input.value = "";
        }

        input.dispatchEvent(new Event("input", { bubbles: true }));
        syncDateClearButtons();
      });

      input.addEventListener("input", syncForInput);
      input.addEventListener("change", syncForInput);
      syncForInput();
    });

    syncDateClearButtons();
  } catch (err) {
    console.warn("date clear button init failed:", err);
  }
}

initContactForm();
