"use client";

import Link from "next/link";
import type { AdminCapabilityKey } from "@/lib/permissions";
import { CAPABILITY_I18N } from "@/lib/permissions";
import { useAuth } from "@/providers/AuthProvider";
import { useLocale } from "@/providers/LocaleProvider";

type Props =
  | { kind: "inactive" }
  | { kind: "capability"; capability: AdminCapabilityKey };

export function AccessDenied(props: Props) {
  const { logout } = useAuth();
  const { t } = useLocale();

  const title =
    props.kind === "inactive" ? t("access.inactiveTitle") : t("access.deniedTitle");
  const body =
    props.kind === "inactive"
      ? t("access.inactiveBody")
      : t("access.deniedBody", { area: t(CAPABILITY_I18N[props.capability]) });

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-16 text-center">
      <span
        className="material-symbols-outlined text-5xl text-on-surface-variant"
        aria-hidden
      >
        lock
      </span>
      <h1 className="text-xl font-bold text-on-surface">{title}</h1>
      <p className="text-sm leading-relaxed text-on-surface-variant">{body}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        {props.kind === "capability" ? (
          <Link
            href="/firma"
            className="btn-accent rounded-full px-5 py-2.5 text-sm font-semibold"
          >
            {t("access.goFirm")}
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => logout()}
          className="rounded-full border border-card-border bg-card px-5 py-2.5 text-sm font-semibold text-ink"
        >
          {t("common.logout")}
        </button>
      </div>
    </div>
  );
}
