import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Bell, FileText, MessagesSquare, Megaphone } from "lucide-react";

import { dashboard } from "@/lib/api.functions";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — EDEM" },
      { name: "description", content: "Your courses, materials, messages and announcements." },
      { property: "og:title", content: "Dashboard — EDEM" },
      { property: "og:description", content: "Your student dashboard on EDEM." },
    ],
  }),
  component: Dashboard,
});

type Course = { id: string; code: string; title: string; level: number | null };
type Material = { id: string; title: string; category: string; course_code: string | null };
type Announcement = { id: string; title: string; body: string };

function Dashboard() {
  const { profile } = useAuth();
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => dashboard() });

  const courses = (data?.courses ?? []) as Course[];
  const materials = (data?.materials ?? []) as Material[];
  const announcements = (data?.announcements ?? []) as Announcement[];

  const stats = [
    { label: "Enrolled courses", value: courses.length, icon: BookOpen, to: "/courses" },
    {
      label: "Conversations",
      value: data?.conversationCount ?? 0,
      icon: MessagesSquare,
      to: "/messages",
    },
    { label: "Unread alerts", value: data?.unread ?? 0, icon: Bell, to: "/notifications" },
  ] as const;

  return (
    <>
      <PageHeader
        title={`Hello, ${profile?.display_name?.split(" ")[0] ?? "student"}`}
        description="Here is what is happening across your courses today."
      />
      <div className="space-y-6 p-4 md:p-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <Link key={s.label} to={s.to}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-2xl font-semibold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Latest materials</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/materials">Browse all</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {materials.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No approved materials yet. Be the first to share one.
                </p>
              )}
              {materials.map((m) => (
                <div key={m.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.course_code ?? "General"} · {m.category.replace("_", " ")}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">My courses</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/courses">Manage</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {courses.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  You have not enrolled in any course yet.
                </p>
              )}
              {courses.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{c.code}</p>
                  </div>
                  {c.level ? <Badge variant="secondary">Level {c.level}</Badge> : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Megaphone className="h-4 w-4 text-accent" />
            <CardTitle className="text-base">Announcements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {announcements.length === 0 && (
              <p className="text-sm text-muted-foreground">No announcements yet.</p>
            )}
            {announcements.map((a) => (
              <div key={a.id} className="rounded-lg border p-4">
                <p className="text-sm font-medium">{a.title}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
