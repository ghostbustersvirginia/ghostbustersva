import type { ReactNode } from "react";

interface StepProgressProps {
  step: number;
  totalSteps: number;
  stepTitles: readonly string[];
  onNodeClick?: (effectiveIndex: number) => void;
}

export default function StepProgress({
  step,
  totalSteps,
  stepTitles,
  onNodeClick,
}: StepProgressProps) {
  const nodes: ReactNode[] = [];

  for (let i = 0; i < totalSteps; i++) {
    const isDone = i < step;
    const isActive = i === step;
    const nodeClass = [
      "arf__step-node",
      isDone ? "arf__step-node--done" : "",
      isActive ? "arf__step-node--active" : "",
      isDone && onNodeClick ? "arf__step-node--clickable" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const ariaLabel = isDone ? `Go to step ${i + 1}: ${stepTitles[i]}` : stepTitles[i];
    const labelClass = [
      "arf__step-label",
      isActive ? "arf__step-label--active" : "",
      isDone ? "arf__step-label--done" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const circle =
      isDone && onNodeClick ? (
        <button
          key={`node-${i}`}
          type="button"
          className={nodeClass}
          onClick={() => onNodeClick(i)}
          aria-label={ariaLabel}
        >
          ✓
        </button>
      ) : (
        <span key={`node-${i}`} className={nodeClass} aria-hidden="true">
          {i + 1}
        </span>
      );

    nodes.push(
      <div key={`col-${i}`} className="arf__step-col">
        {circle}
        <span className={labelClass} aria-hidden="true">
          {stepTitles[i]}
        </span>
      </div>,
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
    <>
      <div className="arf__progress">
        <div className="arf__step-track">{nodes}</div>
      </div>
      <div className="arf__step-meta">
        <h2 className="arf__step-title">{stepTitles[step]}</h2>
        <span className="arf__step-count" aria-live="polite" aria-atomic="true">
          Step {step + 1} of {totalSteps}
        </span>
      </div>
    </>
  );
}
