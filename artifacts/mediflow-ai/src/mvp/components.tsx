import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 border-b border-border pb-5 lg:flex-row lg:items-end">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-accent">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-foreground sm:text-[28px]">
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ActionButton({
  children,
  icon: Icon,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled = false,
  className = '',
  testId,
  title,
}: {
  children: ReactNode;
  icon?: LucideIcon;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  disabled?: boolean;
  className?: string;
  testId?: string;
  title?: string;
}) {
  const styles = {
    primary: 'border border-primary bg-primary text-white hover:bg-[#1d4669]',
    secondary: 'border border-border bg-white text-foreground hover:border-accent hover:text-accent',
    quiet: 'border border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
    danger: 'border border-[#e8c5c1] bg-[#fff6f4] text-[#982c28] hover:bg-[#fbe9e7]',
  };
  return (
    <button
      data-testid={testId}
      title={title}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`mf-action inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {Icon && <Icon size={15} aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Panel({
  children,
  className = '',
  title,
  detail,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`mf-panel overflow-hidden ${className}`}>
      {(title || detail || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            {title && <h2 className="text-sm font-extrabold">{title}</h2>}
            {detail && <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PriorityBadge({
  priority,
  label,
}: {
  priority: 'P1' | 'P2' | 'P3' | 'P4' | null | undefined;
  label?: string;
}) {
  if (!priority) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[#c6d0d7] bg-[#f7f9fa] px-2 py-1 text-[10px] font-bold text-[#526572]">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#71818c]" />
        Sin evaluar
      </span>
    );
  }
  const palette = {
    P1: 'border-[#e7b8b3] bg-[#fff0ee] text-[#952e29]',
    P2: 'border-[#e9c998] bg-[#fff6e8] text-[#8d5410]',
    P3: 'border-[#e8d99c] bg-[#fffbea] text-[#756012]',
    P4: 'border-[#b8d9ca] bg-[#edf8f2] text-[#25634c]',
  };
  const accessibleNames = {
    P1: 'Atención inmediata',
    P2: 'Muy urgente',
    P3: 'Urgente',
    P4: 'No urgente',
  };
  return (
    <span
      title={`${priority}: ${accessibleNames[priority]}`}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-extrabold ${palette[priority]}`}
    >
      <span aria-hidden="true" className="font-mono-ui">{priority}</span>
      {label ?? accessibleNames[priority]}
    </span>
  );
}

export function StateBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'good' | 'warning' | 'critical' | 'info';
}) {
  const tones = {
    neutral: 'border-[#d9e0e5] bg-[#f6f8f9] text-[#4e5d68]',
    good: 'border-[#bad8c9] bg-[#edf8f2] text-[#25634c]',
    warning: 'border-[#e8d39c] bg-[#fff9e9] text-[#735d19]',
    critical: 'border-[#e7b8b3] bg-[#fff0ee] text-[#952e29]',
    info: 'border-[#c4d4e2] bg-[#f0f5fa] text-[#345570]',
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'navy',
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  tone?: 'navy' | 'teal' | 'amber' | 'red';
}) {
  const iconStyles = {
    navy: 'bg-[#edf2f7] text-[#2e506e]',
    teal: 'bg-[#edf7f5] text-[#16796f]',
    amber: 'bg-[#fff7e9] text-[#956216]',
    red: 'bg-[#fff0ee] text-[#a3312c]',
  };
  return (
    <div className="mf-panel p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconStyles[tone]}`}>
          <Icon size={17} aria-hidden="true" />
        </span>
      </div>
      <div className="mt-4 flex items-baseline gap-2">
        <strong className="font-mono-ui text-[30px] font-medium leading-none tracking-[-0.06em]">{value}</strong>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{detail}</p>
    </div>
  );
}

export function EmptyState({
  title,
  detail,
  icon: Icon,
}: {
  title: string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon size={20} aria-hidden="true" />
      </span>
      <h3 className="mt-3 text-sm font-bold">{title}</h3>
      <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

export const fieldClass =
  'mt-1.5 block min-h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground';
