const eventInquiryValues = new Set(["Schedule Event"]);
const loadFlatpickr = () => {
  if (typeof window !== "undefined" && window.flatpickr) {
    return Promise.resolve(window.flatpickr);
  }
  // Try ESM import first for modern browsers
  return import("https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.esm.js")
    .then((m) => m.default || m)
    .catch(() => {
      // Fallback: inject UMD script and resolve window.flatpickr
      return new Promise((resolve, reject) => {
        if (typeof window !== "undefined" && window.flatpickr) {
          return resolve(window.flatpickr);
        }

        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js";
        script.async = true;
        script.onload = () => {
          if (window.flatpickr) {
            resolve(window.flatpickr);
          } else {
            reject(new Error("flatpickr failed to load via UMD fallback"));
          }
        };
        script.onerror = (e) => reject(e || new Error("flatpickr script load error"));
        document.head.appendChild(script);
      });
    });
};
const shouldShowEventFields = (inquiryType) => eventInquiryValues.has((inquiryType || "").trim());

async function initContactForm() {
  if (typeof document === "undefined") {
    return;
  }

  const inquirySelect = document.querySelector("select[name='inquiryType']");
  const dateInput = document.querySelector("[data-date-input]");
  const dateEndInput = document.querySelector("[data-date-end-input]");

  if (!inquirySelect || !dateInput || !dateEndInput) {
    console.warn("initContactForm: missing contact form elements", {
      inquirySelect,
      dateInput,
      dateEndInput,
    });
    return;
  }

  const dateClearButtons = document.querySelectorAll("[data-date-clear]");
  const eventFieldRows = document.querySelectorAll("[data-event-field]");
  const eventRequiredInputs = document.querySelectorAll("[data-event-input]");
  const eventOptionalInputs = document.querySelectorAll("[data-event-optional-input]");

  const syncDateClearButtons = () => {
    dateClearButtons.forEach((button) => {
      const wrapper = button.closest(".contact-form__date-input-wrap");
      const input = wrapper?.querySelector("input");

      if (!input) {
        return;
      }

      button.hidden = !input.value || input.disabled;
    });
  };

  const dateStatus = document.querySelector(".contact-form__status");

  const announceDate = (message) => {
    if (dateStatus) {
      dateStatus.textContent = message;
    }
  };

  const setEventFieldsVisibility = (selectedValue) => {
    const showEventFields = shouldShowEventFields(selectedValue);

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
    const selectedValue = inquirySelect.value || "";

    setEventFieldsVisibility(selectedValue);

    inquirySelect.addEventListener("change", (event) => {
      const value = event.target?.value || "";
      setEventFieldsVisibility(value);
    });
  };

  initializeInquirySelect();

  try {
    const flatpickr = await loadFlatpickr();

    const startDateParent = dateInput.closest(".contact-form__field");
    const endDateParent = dateEndInput.closest(".contact-form__field");

    let endDatePicker = null;

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

        if (selectedStartDate && dateEndInput.value) {
          const parsedEndDate = endDatePicker.parseDate(dateEndInput.value, "m/d/Y");

          if (parsedEndDate && parsedEndDate < selectedStartDate) {
            endDatePicker.clear();
          }
        }

        syncDateClearButtons();
      },
    });

    

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

    

    dateInput.addEventListener("focus", () => {
      try { startDatePicker.open(); } catch (err) { /* ignore */ }
    });

    

    // Close pickers when clicking outside of inputs/calendars
    const clickOutsideHandler = (ev) => {
      try {
        const target = ev.target;
        const calendars = Array.from(document.querySelectorAll(".flatpickr-calendar"));
        const clickedInCalendar = calendars.some((c) => c.contains(target));
        const clickedInInput = (dateInput && (dateInput === target || dateInput.contains && dateInput.contains(target))) ||
          (dateEndInput && (dateEndInput === target || dateEndInput.contains && dateEndInput.contains(target)));

        if (!clickedInCalendar && !clickedInInput) {
          try { startDatePicker?.close?.(); } catch (e) { /* ignore */ }
          try { endDatePicker?.close?.(); } catch (e) { /* ignore */ }
        }
      } catch (err) {
        /* ignore */
      }
    };

    document.addEventListener("click", clickOutsideHandler);
  } catch (err) {
    console.warn("flatpickr init failed:", err);
  }

  try {
    dateClearButtons.forEach((button) => {
      const wrapper = button.closest(".contact-form__date-input-wrap");
      const input = wrapper?.querySelector("input");

      if (!input) {
        return;
      }

      const syncForInput = () => {
        button.hidden = !input.value || input.disabled;
      };

      button.addEventListener("click", () => {
        const pickerInstance = input._flatpickr;

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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initContactForm);
} else {
  initContactForm();
}
