import Link from "next/link";

type StatCardProps = {
  label: string;
  value: string;
  icon: string;
  change?: string;
  hint?: string;
  suffix?: string;
  href?: string;
};

export function StatCard({
  label,
  value,
  icon,
  change,
  hint,
  suffix,
  href,
}: StatCardProps) {
  const inner = (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-inner">
          <span className="material-symbols-outlined text-[24px]">{icon}</span>
        </div>
        {change ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            ↗ {change}
          </span>
        ) : null}
      </div>
      <div>
        <p className="mb-1 text-sm font-medium text-on-surface-variant">{label}</p>
        <h3 className="text-3xl font-bold tracking-tight text-on-surface">
          {value}
          {suffix ? (
            <span className="ml-1 text-sm font-normal text-on-surface-variant">
              {suffix}
            </span>
          ) : null}
        </h3>
        {hint ? <p className="mt-2 text-xs text-on-surface-variant">{hint}</p> : null}
      </div>
    </>
  );

  const className =
    "flex flex-col justify-between rounded-2xl border border-card-border bg-card p-6 shadow-lg shadow-black/20 transition-all duration-300 hover:border-primary/40";

  if (href) {
    return (
      <Link href={href} className={`${className} cursor-pointer hover:bg-surface-container-high/40`}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}
