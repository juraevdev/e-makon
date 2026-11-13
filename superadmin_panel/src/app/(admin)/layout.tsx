"use client";

import { AppShell } from "@/components/layout/AppShell";
import { LoadingScreen } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return <LoadingScreen />;
  }

  return <AppShell>{children}</AppShell>;
}
