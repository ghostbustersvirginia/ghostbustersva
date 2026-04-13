interface FieldErrorProps {
  id: string;
  message?: string;
}

export default function FieldError({ id, message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <span id={id} className="arf__error" role="alert">
      {message}
    </span>
  );
}

