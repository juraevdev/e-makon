"use client";

import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/providers/AuthProvider";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
