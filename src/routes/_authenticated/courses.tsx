import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { enrol as enrolFn, listCourses, listEnrolments, unenrol as unenrolFn } from "@/lib/api.functions";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { errMessage } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/courses")({
  head: () => ({
    meta: [
      { title: "Courses — EDEM" },
      { name: "description", content: "Browse courses and enrol to join their group chats." },
      { property: "og:title", content: "Courses — EDEM" },
      { property: "og:description", content: "Enrol in your courses on EDEM." },
    ],
  }),
  component: Courses,
});

type Course = {
  id: string;
  code: string;
  title: string;
  department: string | null;
  level: number | null;
  description: string | null;
};

function Courses() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => (await listCourses()) as Course[],
  });

  const { data: enrolments = [] } = useQuery({
    queryKey: ["enrolments"],
    queryFn: async () => (await listEnrolments()).map((e) => e.course_id),
  });

  const enrol = useMutation({
    mutationFn: (courseId: string) => enrolFn({ data: { courseId } }),
    onSuccess: () => {
      toast.success("Enrolled. The course group chat is now in your messages.");
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const unenrol = useMutation({
    mutationFn: (courseId: string) => unenrolFn({ data: { courseId } }),
    onSuccess: () => {
      toast.success("Removed from your courses.");
      void queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  const term = q.trim().toLowerCase();
  const filtered = courses.filter(
    (c) =>
      !term ||
      c.code.toLowerCase().includes(term) ||
      c.title.toLowerCase().includes(term) ||
      (c.department ?? "").toLowerCase().includes(term),
  );

  return (
    <>
      <PageHeader
        title="Courses"
        description="Enrol in a course to unlock its materials and group chat."
      />
      <div className="space-y-5 p-4 md:p-8">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by code, title or department"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={80}
          />
        </div>

        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No courses found. An administrator can add courses from the admin area.
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const joined = enrolments.includes(c.id);
            return (
              <Card key={c.id}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-sm font-semibold text-muted-foreground">
                        {c.code}
                      </p>
                      <h3 className="truncate text-base font-semibold">{c.title}</h3>
                    </div>
                    {c.level ? <Badge variant="secondary">L{c.level}</Badge> : null}
                  </div>
                  {c.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{c.department ?? "General"}</p>
                  <Button
                    className="w-full"
                    variant={joined ? "outline" : "default"}
                    disabled={enrol.isPending || unenrol.isPending}
                    onClick={() => (joined ? unenrol.mutate(c.id) : enrol.mutate(c.id))}
                  >
                    {joined ? "Leave course" : "Enrol"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
