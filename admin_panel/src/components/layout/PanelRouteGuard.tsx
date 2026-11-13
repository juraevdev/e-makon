"use client";

import { usePathname } from "next/navigation";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { capabilityForPath } from "@/lib/permissions";
import { useAdminAccess } from "@/providers/AdminAccessProvider";

export function PanelRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { capabilities, loading } = useAdminAccess();

  if (loading || !capabilities) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-primary">
          progress_activity
        </span>
      </div>
    );
  }

  if (!capabilities.profileActive) {
    return <AccessDenied kind="inactive" />;
  }

  const need = capabilityForPath(pathname);
  if (need && !capabilities[need]) {
    return <AccessDenied kind="capability" capability={need} />;
  }

  return <>{children}</>;
}
