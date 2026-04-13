import type { ReactNode } from "react";

interface FormLabelProps {
  htmlFor: string;
  children: ReactNode;
  required?: boolean;
}

export default function FormLabel({ htmlFor, children, required }: FormLabelProps) {
  return (
    <label className="arf__label" htmlFor={htmlFor}>
      {children}
      {required && (
        <span className="arf__required" aria-label="required">
          {" "}
          *
        </span>
      )}
    </label>
  );
}

