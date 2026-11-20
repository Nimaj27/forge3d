/** Champs de saisie numériques (format français, mm) et contrôles segmentés. */
import { useEffect, useId, useState, type ReactNode } from 'react';
import { formatNumber, parseNumber } from '../lib/format';

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  /** Unité affichée dans le libellé accessible */
  unit?: string;
  compact?: boolean;
  disabled?: boolean;
}

/** Saisie d'un nombre : virgule ou point acceptés, validation à la sortie du champ ou sur Entrée. */
export function NumberField({ label, value, onChange, min = -Infinity, max = Infinity, step = 1, decimals = 2, unit = 'mm', compact, disabled }: NumberFieldProps) {
  const [draft, setDraft] = useState(() => formatNumber(value, decimals));
  const [editing, setEditing] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!editing) setDraft(formatNumber(value, decimals));
  }, [value, decimals, editing]);

  const commit = (text: string) => {
    const v = parseNumber(text);
    if (Number.isFinite(v)) {
      const clamped = Math.min(max, Math.max(min, v));
      if (clamped !== value) onChange(clamped);
      setDraft(formatNumber(clamped, decimals));
    } else {
      setDraft(formatNumber(value, decimals));
    }
  };

  return (
    <label className="field" htmlFor={id} style={compact ? { gap: 4 } : undefined}>
      <span className="field__label" style={compact ? { fontSize: 12 } : undefined}>
        {label}
        {unit && <span className="sr-only"> en {unit === 'mm' ? 'millimètres' : unit}</span>}
      </span>
      <input
        id={id}
        className="input input--num"
        inputMode="decimal"
        autoComplete="off"
        value={draft}
        disabled={disabled}
        style={compact ? { minHeight: 40 } : undefined}
        onFocus={(e) => {
          setEditing(true);
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => {
          setEditing(false);
          commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit(e.currentTarget.value);
            e.currentTarget.blur();
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const cur = parseNumber(e.currentTarget.value);
            const base = Number.isFinite(cur) ? cur : value;
            const delta = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            const next = Math.min(max, Math.max(min, Math.round((base + delta) * 1e6) / 1e6));
            setDraft(formatNumber(next, decimals));
            onChange(next);
          } else if (e.key === 'Escape') {
            setDraft(formatNumber(value, decimals));
            e.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

interface SliderFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  /** Texte affiché à droite du libellé */
  display?: string;
}

export function SliderField({ label, value, onChange, min, max, step, display }: SliderFieldProps) {
  const id = useId();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        <span>{label}</span>
        <span className="field__value">{display ?? formatNumber(value, 1)}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        aria-valuetext={display}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  inset?: boolean;
}

/** Groupe de boutons exclusifs (aria-pressed), par exemple Solide / Trou. */
export function Segmented<T extends string>({ label, value, options, onChange, inset = true }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={`segmented segmented--grid ${inset ? 'segmented--inset' : ''}`}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} title={o.title} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface Vec3FieldsProps {
  legend: string;
  labels: [string, string, string];
  value: readonly [number, number, number];
  onChange: (v: [number, number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  unit?: string;
}

/** Trois champs côte à côte (dimensions, position, rotation). */
export function Vec3Fields({ legend, labels, value, onChange, min, max, step = 1, decimals = 2, unit = 'mm' }: Vec3FieldsProps) {
  return (
    <fieldset className="fieldset">
      <legend className="field__label">{legend}</legend>
      <div className="grid-3">
        {labels.map((l, i) => (
          <NumberField
            key={l}
            compact
            label={l}
            unit={unit}
            value={value[i]}
            min={min}
            max={max}
            step={step}
            decimals={decimals}
            onChange={(v) => {
              const next = [...value] as [number, number, number];
              next[i] = v;
              onChange(next);
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}
