import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  adminAddCourse,
  adminDecide,
  adminPending,
  adminPeople,
  adminPostAnnouncement,
  adminReports,
  adminResolveReport,
  adminSetRole,
  adminToggleSuspend,
} from "@/lib/api.functions";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { errMessage } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — EDEM" },
      { name: "description", content: "Approve uploads, handle reports and manage accounts." },
      { property: "og:title", content: "Admin — EDEM" },
      { property: "og:description", content: "EDEM administration area." },
    ],
  }),
  component: Admin,
});

type Pending = { id: string; title: string; description: string | null; category: string; file_name: string };
type Report = {
  id: string;
  target_type: string;
  target_id: string | null;
  reason: string;
  status: string;
  created_at: string;
};
type Person = {
  id: string;
  display_name: string;
  student_number: string | null;
  programme: string | null;
  status: string;
  roles: string;
};

function Admin() {
  const { isStaff, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [course, setCourse] = useState({ code: "", title: "", level: "", department: "" });
  const [announcement, setAnnouncement] = useState({ title: "", body: "" });

  const { data: pending = [] } = useQuery({
    queryKey: ["admin", "pending"],
    enabled: isStaff,
    queryFn: async () => (await adminPending()) as Pending[],
  });
  const { data: reports = [] } = useQuery({
    queryKey: ["admin", "reports"],
    enabled: isStaff,
    queryFn: async () => (await adminReports()) as Report[],
  });
  const { data: people = [] } = useQuery({
    queryKey: ["admin", "people"],
    enabled: isStaff,
    queryFn: async () => (await adminPeople()) as Person[],
  });

  if (!isStaff) {
    return (
      <>
        <PageHeader title="Admin" description="Restricted area." />
        <div className="p-4 md:p-8">
          <p className="text-sm text-muted-foreground">
            You need a moderator or administrator role to open this page.
          </p>
        </div>
      </>
    );
  }

  const run = async (fn: () => Promise<unknown>, message: string, keys: string[][]) => {
    try {
      await fn();
      toast.success(message);
      keys.forEach((k) => void queryClient.invalidateQueries({ queryKey: k }));
    } catch (err) {
      toast.error(errMessage(err));
    }
  };

  return (
    <>
      <PageHeader title="Admin" description="Uploads, reports, accounts, courses and notices." />
      <div className="p-4 md:p-8">
        <Tabs defaultValue="uploads">
          <TabsList className="flex-wrap">
            <TabsTrigger value="uploads">Uploads ({pending.length})</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
            <TabsTrigger value="courses">Courses</TabsTrigger>
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
          </TabsList>

          <TabsContent value="uploads" className="mt-5 space-y-3">
            {pending.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing waiting for review.</p>
            )}
            {pending.map((m) => (
              <Card key={m.id}>
                <CardContent className="flex flex-wrap items-start justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <p className="font-medium">{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.category} · {m.file_name}
                    </p>
                    {m.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`/api/files/${m.id}`, "_blank", "noopener")}
                    >
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        run(
                          () => adminDecide({ data: { id: m.id, status: "approved" } }),
                          "Approved.",
                          [["admin", "pending"], ["materials"]],
                        )
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        run(
                          () => adminDecide({ data: { id: m.id, status: "rejected" } }),
                          "Rejected.",
                          [["admin", "pending"], ["materials"]],
                        )
                      }
                    >
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="reports" className="mt-5 space-y-3">
            {reports.length === 0 && <p className="text-sm text-muted-foreground">No reports.</p>}
            {reports.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex flex-wrap items-start justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{r.target_type}</Badge>
                      <Badge variant={r.status === "open" ? "destructive" : "outline"}>
                        {r.status}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm">{r.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </p>
                  </div>
                  {r.status === "open" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        run(
                          () => adminResolveReport({ data: { id: r.id } }),
                          "Marked resolved.",
                          [["admin", "reports"]],
                        )
                      }
                    >
                      Mark resolved
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="people" className="mt-5 space-y-3">
            {people.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <p className="font-medium">{p.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.student_number ?? "—"} · {p.programme ?? "—"} · {p.roles}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={p.status === "suspended" ? "destructive" : "secondary"}>
                      {p.status}
                    </Badge>
                    {isAdmin && (
                      <>
                        <Select
                          onValueChange={(role) =>
                            run(
                              () =>
                                adminSetRole({
                                  data: { id: p.id, role: role as "student" | "moderator" | "admin" },
                                }),
                              "Role updated.",
                              [["admin", "people"]],
                            )
                          }
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Set role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="moderator">Moderator</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            run(
                              () => adminToggleSuspend({ data: { id: p.id } }),
                              "Account updated.",
                              [["admin", "people"]],
                            )
                          }
                        >
                          {p.status === "suspended" ? "Restore" : "Suspend"}
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="courses" className="mt-5">
            <Card className="max-w-xl">
              <CardHeader>
                <CardTitle className="text-base">Add a course</CardTitle>
                <CardDescription>Students can then enrol and join its group chat.</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await run(
                      () => adminAddCourse({ data: course }),
                      "Course added.",
                      [["courses"]],
                    );
                    setCourse({ code: "", title: "", level: "", department: "" });
                  }}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="code">Course code</Label>
                      <Input
                        id="code"
                        value={course.code}
                        maxLength={20}
                        onChange={(e) => setCourse({ ...course, code: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="level">Level</Label>
                      <Input
                        id="level"
                        inputMode="numeric"
                        value={course.level}
                        maxLength={4}
                        onChange={(e) => setCourse({ ...course, level: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ctitle">Title</Label>
                    <Input
                      id="ctitle"
                      value={course.title}
                      maxLength={150}
                      onChange={(e) => setCourse({ ...course, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dept">Department</Label>
                    <Input
                      id="dept"
                      value={course.department}
                      maxLength={120}
                      onChange={(e) => setCourse({ ...course, department: e.target.value })}
                    />
                  </div>
                  <Button type="submit">Add course</Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="announcements" className="mt-5">
            <Card className="max-w-xl">
              <CardHeader>
                <CardTitle className="text-base">Post an announcement</CardTitle>
                <CardDescription>Every student gets a notification.</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await run(
                      () => adminPostAnnouncement({ data: announcement }),
                      "Announcement posted.",
                      [["dashboard"], ["notifications"]],
                    );
                    setAnnouncement({ title: "", body: "" });
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="atitle">Title</Label>
                    <Input
                      id="atitle"
                      value={announcement.title}
                      maxLength={150}
                      onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="abody">Message</Label>
                    <Textarea
                      id="abody"
                      value={announcement.body}
                      maxLength={1000}
                      onChange={(e) => setAnnouncement({ ...announcement, body: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit">Post announcement</Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
