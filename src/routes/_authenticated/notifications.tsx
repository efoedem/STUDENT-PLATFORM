import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";

import { listNotifications, markAllRead } from "@/lib/api.functions";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — EDEM" },
      { name: "description", content: "Replies, mentions, approvals and announcements." },
      { property: "og:title", content: "Notifications — EDEM" },
      { property: "og:description", content: "Your EDEM activity feed." },
    ],
  }),
  component: Notifications,
});

type Note = {
  id: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
};

function Notifications() {
  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await listNotifications()) as Note[],
  });

  async function markAll() {
    await markAllRead();
    void queryClient.invalidateQueries();
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Everything that happened while you were away."
        action={
          <Button variant="outline" onClick={markAll}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all read
          </Button>
        }
      />
      <div className="space-y-3 p-4 md:p-8">
        {items.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
              <Bell className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">You have no notifications yet.</p>
            </CardContent>
          </Card>
        )}
        {items.map((n) => (
          <Card key={n.id} className={cn(!n.read && "border-accent/60 bg-accent/5")}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(n.created_at).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
