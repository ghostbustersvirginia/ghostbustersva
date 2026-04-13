import type { ReactNode } from "react";

interface StepProgressProps {
  step: number;
  totalSteps: number;
  stepTitles: readonly string[];
}

export default function StepProgress({ step, totalSteps, stepTitles }: StepProgressProps) {
  const nodes: ReactNode[] = [];

  for (let i = 0; i < totalSteps; i++) {
    const nodeClass = [
      "arf__step-node",
      i < step ? "arf__step-node--done" : "",
      i === step ? "arf__step-node--active" : "",
    ]
      .filter(Boolean)
      .join(" ");

    nodes.push(
      <span key={`node-${i}`} className={nodeClass} aria-hidden="true">
        {i < step ? "✓" : i + 1}
      </span>,
    );

    if (i < totalSteps - 1) {
      nodes.push(
        <span
          key={`conn-${i}`}
          className={["arf__step-connector", i < step ? "arf__step-connector--done" : ""]
            .filter(Boolean)
            .join(" ")}
          aria-hidden="true"
        />,
      );
    }
  }

  return (
    <div className="arf__progress">
      <div className="arf__step-track" aria-hidden="true">
        {nodes}
      </div>
      <div className="arf__step-meta">
        <span className="arf__step-count" aria-live="polite" aria-atomic="true">
          Step {step + 1} of {totalSteps}
        </span>
        <h2 className="arf__step-title">{stepTitles[step]}</h2>
      </div>
    </div>
  );
}

