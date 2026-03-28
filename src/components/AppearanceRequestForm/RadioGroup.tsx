interface RadioGroupProps {
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  errorId?: string;
}

export default function RadioGroup({ name, options, value, onChange, errorId }: RadioGroupProps) {
  return (
    <div className="arf__radio-group" role="group" aria-describedby={errorId}>
      {options.map((opt) => (
        <label key={opt.value} className="arf__radio-option">
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <span className="arf__radio-label">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

