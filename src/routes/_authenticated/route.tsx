import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { me } from "@/lib/api.functions";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const session = await me();
    if (!session) throw redirect({ to: "/auth" });
    return { session };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
