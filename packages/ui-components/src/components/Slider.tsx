import React from 'react';

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  unit?: string;
  disabled?: boolean;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  unit = '',
  disabled = false,
}) => {
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center mb-1.5">
          <label className="text-sm font-medium text-gray-200">{label}</label>
          <span className="text-sm font-mono text-blue-400 font-semibold">
            {value}{unit}
          </span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50"
      />
    </div>
  );
};
