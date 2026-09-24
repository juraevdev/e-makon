import Link from "next/link";
import React from "react";

export type Crumb = {
  label: string;
  href?: string;
};

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (!items.length) return null;

  return (
    <nav className="mb-4 flex items-center gap-1.5 text-xs text-on-surface-variant" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <React.Fragment key={`${item.label}-${index}`}>
            {index > 0 && (
              <span className="material-symbols-outlined text-[14px] text-outline-variant">
                chevron_right
              </span>
            )}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="transition-colors hover:text-primary focus:underline focus:outline-none"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-semibold text-on-surface" : ""}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
