import type { ReactNode } from "react";

type PageHeaderProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        {title ? (
          <h2 className="mb-1 text-2xl font-bold text-on-surface md:text-[32px] md:leading-10">
            {title}
          </h2>
        ) : null}
        {description ? (
          <p className="max-w-3xl text-sm text-on-surface-variant md:text-base">
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
