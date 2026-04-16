import { useState, useRef, useEffect } from "react";
import FieldError from "./FieldError";

interface FormSelectOption {
  value: string;
  label: string;
}

interface FormSelectProps {
  id: string;
  label: string;
  options: FormSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  errorId?: string;
  errorMessage?: string;
}

export default function FormSelect({
  id,
  label,
  options,
  value,
  onChange,
  placeholder = "Select an option\u2026",
  required,
  errorId,
  errorMessage,
}: FormSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const announcerId = `${id}-announcer`;

  const selectedOption = options.find((o) => o.value === value);
  const triggerText = selectedOption?.label ?? placeholder;
  const isPlaceholder = !selectedOption;

  const optId = (opt: FormSelectOption) =>
    `${id}-opt-${opt.value.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;

  const clamp = (idx: number) => Math.max(0, Math.min(idx, options.length - 1));

  function doOpen() {
    const startIdx = options.findIndex((o) => o.value === value);
    setActiveIdx(startIdx >= 0 ? startIdx : 0);
    setOpen(true);
  }

  function doClose(refocus = true) {
    setOpen(false);
    setActiveIdx(-1);
    if (refocus) triggerRef.current?.focus();
  }

  function doSelect(opt: FormSelectOption) {
    onChange(opt.value);
    const el = document.getElementById(announcerId);
    if (el) el.textContent = `${opt.label} selected`;
    doClose();
  }

  // Scroll the active option into view inside the listbox
  useEffect(() => {
    if (!open || activeIdx < 0 || !listRef.current) return;
    const optEls = listRef.current.querySelectorAll<HTMLLIElement>('[role="option"]');
    optEls[activeIdx]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIdx]);

  // Click-outside closes the dropdown
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setActiveIdx(-1);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        open ? setActiveIdx((i) => clamp(i + 1)) : doOpen();
        break;
      case "ArrowUp":
        e.preventDefault();
        if (open) setActiveIdx((i) => clamp(i - 1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (open && activeIdx >= 0) doSelect(options[activeIdx]);
        else doOpen();
        break;
      case "Escape":
        e.preventDefault();
        if (open) doClose();
        break;
      case "Tab":
        if (open) doClose(false);
        break;
    }
  }

  return (
    <div
      className={["arf__dropdown", open ? "is-open" : "", errorMessage ? "has-error" : ""]
        .filter(Boolean)
        .join(" ")}
      ref={containerRef}
    >
      <span id={`${id}-label`} className="arf__label">
        {label}
        {required && (
          <span className="arf__required" aria-label="required">
            {" "}
            *
          </span>
        )}
      </span>

      <div className="arf__dropdown__control">
        <button
          type="button"
          ref={triggerRef}
          id={`${id}-trigger`}
          className="arf__dropdown__trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-labelledby={`${id}-label ${id}-trigger-text`}
          aria-required={required ? "true" : undefined}
          aria-describedby={errorId ?? undefined}
          {...(isPlaceholder ? { "data-placeholder": "" } : {})}
          onKeyDown={handleKeyDown}
          onClick={() => (open ? doClose() : doOpen())}
        >
          <span id={`${id}-trigger-text`} className="arf__dropdown__trigger-text">
            {triggerText}
          </span>
          <svg
            className="arf__dropdown__chevron"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        <ul
          id={`${id}-listbox`}
          ref={listRef}
          role="listbox"
          className="arf__dropdown__list"
          aria-labelledby={`${id}-label`}
          tabIndex={-1}
        >
          {options.map((opt, i) => (
            <li
              key={opt.value}
              id={optId(opt)}
              role="option"
              className={[
                "arf__dropdown__option",
                opt.value === value ? "is-selected" : "",
                open && i === activeIdx ? "is-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-value={opt.value}
              aria-selected={opt.value === value}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => doSelect(opt)}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      </div>

      <span
        id={announcerId}
        className="arf__dropdown__announcer"
        aria-live="polite"
        aria-atomic="true"
      />

      {errorMessage && <FieldError id={errorId ?? `${id}-error`} message={errorMessage} />}
    </div>
  );
}
