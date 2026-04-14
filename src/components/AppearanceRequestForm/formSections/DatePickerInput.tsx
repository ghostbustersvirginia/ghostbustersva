import { useEffect, useRef } from "react";

interface DatePickerInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  mode?: "date" | "time";
  minDate?: string;
  minTime?: string;
  "aria-required"?: "true";
  "aria-describedby"?: string;
}

interface FlatpickrInstance {
  destroy: () => void;
  clear: () => void;
  close: () => void;
  setDate: (date: string, triggerChange: boolean) => void;
  set: (option: string, value: unknown) => void;
  input: HTMLInputElement;
  calendarContainer: HTMLElement;
}

type FlatpickrFn = (el: HTMLElement, opts: Record<string, unknown>) => FlatpickrInstance;

interface WindowWithFlatpickr extends Window {
  flatpickr?: FlatpickrFn;
}

/** Convert "h:i K" (e.g. "3:00 PM") to 24h "HH:mm" for flatpickr minTime/maxTime options. */
function to24h(timeStr: string): string | null {
  const match = timeStr.match(/^(\d+):(\d+)\s+(AM|PM)$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && hours !== 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

// Same lazy-load pattern as contact-form-client.js
async function loadFlatpickr(): Promise<FlatpickrFn> {
  if (typeof window !== "undefined" && (window as WindowWithFlatpickr).flatpickr) {
    return (window as WindowWithFlatpickr).flatpickr!;
  }
  try {
    // Dynamic CDN import — vite-ignore prevents bundler resolution
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await (Function(
      'return import("https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.esm.js")',
    )() as Promise<any>);
    return (mod.default ?? mod) as FlatpickrFn;
  } catch {
    return new Promise((resolve, reject) => {
      if ((window as WindowWithFlatpickr).flatpickr) {
        return resolve((window as WindowWithFlatpickr).flatpickr!);
      }
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/flatpickr@4.6.13/dist/flatpickr.min.js";
      script.async = true;
      script.onload = () => {
        const fp = (window as WindowWithFlatpickr).flatpickr;
        fp ? resolve(fp) : reject(new Error("flatpickr failed to load"));
      };
      script.onerror = () => reject(new Error("flatpickr script load error"));
      document.head.appendChild(script);
    });
  }
}

export default function DatePickerInput({
  id,
  value,
  onChange,
  className,
  mode = "date",
  minDate,
  minTime,
  ...rest
}: DatePickerInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<FlatpickrInstance | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const minTimeRef = useRef(minTime);
  minTimeRef.current = minTime;

  useEffect(() => {
    if (!inputRef.current) return;
    let destroyed = false;

    const dateOpts: Record<string, unknown> = {
      dateFormat: "m/d/Y",
      disableMobile: true,
      allowInput: true,
      clickOpens: true,
      position: "below right",
      monthSelectorType: "static",
      minDate: minDate ?? "today",
      appendTo: document.body,
      onChange: (_: unknown, dateStr: string) => {
        onChangeRef.current(dateStr);
      },
    };

    const timeOpts: Record<string, unknown> = {
      enableTime: true,
      noCalendar: true,
      dateFormat: "h:i K",
      disableMobile: true,
      allowInput: false,
      clickOpens: true,
      position: "below right",
      appendTo: document.body,
      ...(minTimeRef.current ? { minTime: to24h(minTimeRef.current) ?? minTimeRef.current } : {}),
      onChange: (_: unknown, timeStr: string) => {
        onChangeRef.current(timeStr);
      },
      onReady: (_sel: unknown, _str: unknown, fp: FlatpickrInstance) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "arf__flatpickr-done";
        btn.innerHTML =
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> Done';
        btn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          fp.close();
        });
        fp.calendarContainer.appendChild(btn);
      },
    };

    void loadFlatpickr().then((fp) => {
      if (destroyed || !inputRef.current) return;
      pickerRef.current = fp(inputRef.current, mode === "time" ? timeOpts : dateOpts);
      if (value) pickerRef.current.setDate(value, false);
    });

    return () => {
      destroyed = true;
      pickerRef.current?.destroy();
      pickerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Sync external value changes (e.g. session restore or form reset)
  useEffect(() => {
    if (!pickerRef.current) return;
    if (!value) {
      pickerRef.current.clear();
      return;
    }
    if (pickerRef.current.input.value !== value) {
      pickerRef.current.setDate(value, false);
    }
  }, [value]);

  // Update minDate when the prop changes (e.g. end date constrained by start date)
  useEffect(() => {
    if (pickerRef.current && mode === "date") {
      pickerRef.current.set("minDate", minDate ?? "today");
    }
  }, [minDate, mode]);

  // Update minTime when the prop changes (e.g. end time constrained by start time on the same day)
  useEffect(() => {
    if (!pickerRef.current || mode !== "time") return;
    if (minTime) {
      pickerRef.current.set("minTime", to24h(minTime) ?? minTime);
    } else {
      pickerRef.current.set("minTime", "");
    }
  }, [minTime, mode]);

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      className={className}
      defaultValue={value}
      placeholder={mode === "time" ? "e.g. 12:00 PM" : "mm/dd/yyyy"}
      readOnly
      {...rest}
    />
  );
}
