import type { ReactNode } from "react";

type PageHeaderProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="relative">
        <div
          className="pointer-events-none absolute -left-3 -top-2 h-16 w-16 rounded-full bg-primary/10 blur-2xl"
          aria-hidden
        />
        {title ? (
          <h2 className="relative mb-1 text-2xl font-bold text-ink md:text-[32px] md:leading-10">
            {title}
          </h2>
        ) : null}
        {description ? (
          <p className="relative max-w-3xl text-sm text-ink-muted md:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </div>
  );
}
