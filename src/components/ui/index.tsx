'use client';

/**
 * Nuvia UI primitives. Design rules: docs/UX_DESIGN_DIRECTION.md.
 * Everything here is token-driven (bg-card, text-muted, bg-accent …) so it
 * works in light and dark themes without per-component overrides.
 */
import React from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';

/* ── Card ────────────────────────────────────────────────────────────────── */

export function Card({
  className = '',
  children,
  as: Tag = 'section',
  ...rest
}: React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' | 'article' }) {
  return (
    <Tag className={`rounded-[var(--radius-card)] bg-card border border-line/60 ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/* ── SectionHeader ───────────────────────────────────────────────────────── */

export function SectionHeader({
  title,
  action,
  onAction,
  className = '',
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{title}</h2>
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-0.5 text-xs font-semibold text-muted hover:text-fg transition-colors cursor-pointer -my-2 py-2"
        >
          {action}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/* ── StatTile ────────────────────────────────────────────────────────────── */

export function StatTile({
  label,
  value,
  unit,
  hint,
  onClick,
  emphasis = false,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  onClick?: () => void;
  emphasis?: boolean;
}) {
  const body = (
    <>
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span className="mt-2 flex items-baseline gap-1">
        <span
          className={`text-[26px] leading-none font-extrabold tabular-nums tracking-tight ${
            emphasis ? 'text-green-ink' : 'text-fg'
          }`}
        >
          {value}
        </span>
        {unit && <span className="text-xs font-semibold text-muted">{unit}</span>}
      </span>
      {hint && <span className="mt-1.5 text-[11px] font-medium text-subtle leading-snug">{hint}</span>}
    </>
  );
  const cls =
    'flex flex-col items-start text-left rounded-[var(--radius-card)] bg-card border border-line/60 p-4 min-h-[104px]';
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} hover:bg-elevated/40 transition-colors cursor-pointer`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/* ── ProgressRing ────────────────────────────────────────────────────────── */

export function ProgressRing({
  value,
  max,
  size = 88,
  stroke = 7,
  children,
  label,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
  label: string;
}) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${value} of ${max}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--theme-elevated)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--theme-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/* ── ProgressBar ─────────────────────────────────────────────────────────── */

export function ProgressBar({
  value,
  max,
  tone = 'accent',
  label,
  className = '',
}: {
  value: number;
  max: number;
  tone?: 'accent' | 'fg' | 'warn' | 'info';
  label?: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fill = { accent: 'bg-accent', fg: 'bg-fg', warn: 'bg-warn', info: 'bg-info' }[tone];
  return (
    <div
      className={`h-1.5 w-full rounded-full bg-elevated overflow-hidden ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
    >
      <div className={`h-full rounded-full ${fill} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ── BarChart (dependency-free SVG) ──────────────────────────────────────── */

export interface BarDatum {
  label: string;
  value: number;
  highlight?: boolean;
  title?: string;
}

export function BarChart({
  data,
  height = 120,
  goal,
  formatValue = (v) => String(Math.round(v)),
  ariaLabel,
}: {
  data: BarDatum[];
  height?: number;
  goal?: number;
  formatValue?: (v: number) => string;
  ariaLabel: string;
}) {
  const max = Math.max(goal ?? 0, ...data.map((d) => d.value), 1);
  const goalPct = goal ? (goal / max) * 100 : null;
  return (
    <figure aria-label={ariaLabel} className="w-full">
      <div className="relative w-full" style={{ height }}>
        {goalPct !== null && (
          <div
            className="absolute left-0 right-0 border-t border-dashed border-fg/25 pointer-events-none"
            style={{ bottom: `${goalPct}%` }}
            aria-hidden
          >
            <span className="absolute -top-4 right-0 text-[10px] font-semibold text-subtle">Goal {formatValue(goal!)}</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-end gap-1.5">
          {data.map((d, i) => {
            const h = d.value > 0 ? Math.max(4, (d.value / max) * 100) : 0;
            return (
              <div key={i} className="flex-1 h-full flex flex-col justify-end items-center" title={d.title ?? `${d.label}: ${formatValue(d.value)}`}>
                {d.value > 0 ? (
                  <div
                    className={`w-full max-w-[28px] rounded-[6px] transition-[height] duration-500 ${
                      d.highlight ? 'bg-accent' : 'bg-fg/20'
                    }`}
                    style={{ height: `${h}%` }}
                  />
                ) : (
                  <div className="w-full max-w-[28px] h-[3px] rounded-full bg-elevated" />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex gap-1.5">
        {data.map((d, i) => (
          <span
            key={i}
            className={`flex-1 text-center text-[10px] font-semibold tabular-nums ${d.highlight ? 'text-fg' : 'text-subtle'}`}
          >
            {d.label}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">
        {data.map((d) => `${d.label} ${formatValue(d.value)}`).join(', ')}
      </figcaption>
    </figure>
  );
}

/* ── SegmentedControl ────────────────────────────────────────────────────── */

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={`flex p-1 rounded-[14px] bg-elevated/70 ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`flex-1 min-h-[34px] px-2 rounded-[10px] text-xs font-bold transition-colors cursor-pointer ${
              active ? 'bg-card text-fg shadow-sm' : 'text-muted hover:text-fg'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Chip ────────────────────────────────────────────────────────────────── */

export function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`shrink-0 h-9 px-3.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
        selected
          ? 'bg-fg text-app border-fg'
          : 'bg-card text-fg-soft border-line hover:border-fg/30'
      }`}
    >
      {children}
    </button>
  );
}

/* ── EmptyState ──────────────────────────────────────────────────────────── */

export function EmptyState({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'py-6 px-4' : 'py-10 px-6'}`}>
      <div className="w-11 h-11 rounded-full bg-elevated flex items-center justify-center text-muted">
        <Icon className="w-5 h-5" />
      </div>
      <p className="mt-3 text-sm font-bold text-fg">{title}</p>
      {body && <p className="mt-1 text-xs text-muted max-w-[260px] leading-relaxed">{body}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 h-10 px-4 rounded-[var(--radius-control)] bg-accent text-on-accent text-xs font-extrabold hover:bg-accent-hover transition-colors cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/* ── Skeleton ────────────────────────────────────────────────────────────── */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-[var(--radius-control)] bg-elevated/70 ${className}`} aria-hidden />;
}
