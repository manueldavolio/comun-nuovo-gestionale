"use client";

import { Minus, Plus } from "lucide-react";
import { clampStepperValue, stepValue } from "@/lib/mister-incomplete";

type TouchStepperProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  size?: "md" | "lg";
  "aria-label"?: string;
};

export function TouchStepper({
  value,
  onChange,
  disabled = false,
  min = 0,
  max = 99,
  size = "md",
  "aria-label": ariaLabel = "Valore",
}: TouchStepperProps) {
  const btnClass =
    size === "lg"
      ? "h-12 w-12 text-lg"
      : "h-11 w-11 text-base";

  function bump(delta: number) {
    if (disabled) return;
    onChange(stepValue(value, delta, min, max));
  }

  return (
    <div
      className={`inline-flex items-center gap-2 ${disabled ? "opacity-40" : ""}`}
      aria-label={ariaLabel}
    >
      <button
        type="button"
        disabled={disabled || value <= min}
        onClick={() => bump(-1)}
        className={`${btnClass} inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white font-bold text-blue-800 shadow-sm active:scale-95 disabled:cursor-not-allowed`}
        aria-label={`Diminuisci ${ariaLabel}`}
      >
        <Minus className="h-5 w-5" />
      </button>
      <span
        className={`min-w-10 text-center font-black tabular-nums text-blue-900 ${
          size === "lg" ? "text-3xl" : "text-xl"
        }`}
      >
        {clampStepperValue(value, min, max)}
      </span>
      <button
        type="button"
        disabled={disabled || value >= max}
        onClick={() => bump(1)}
        className={`${btnClass} inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white font-bold text-blue-800 shadow-sm active:scale-95 disabled:cursor-not-allowed`}
        aria-label={`Aumenta ${ariaLabel}`}
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
}
