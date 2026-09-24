import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Flag, MessagesSquare, Search, User } from "lucide-react";
import { toast } from "sonner";

import {
  createReport,
  listBlocks,
  listStudents,
  startDirectChat,
  toggleBlock as toggleBlockFn,
} from "@/lib/api.functions";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { errMessage } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({
    meta: [
      { title: "Students — EDEM" },
      { name: "description", content: "Find classmates, start a private chat, block or report." },
      { property: "og:title", content: "Students — EDEM" },
      { property: "og:description", content: "The EDEM student directory." },
    ],
  }),
  component: Students,
});

type Student = {
  id: string;
  display_name: string;
  avatar_url?: string | null;
  programme: string | null;
  department: string | null;
  level: number | null;
  student_number?: string | null;
  bio?: string | null;
};

function Students() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const { data: students = [] } = useQuery({
    queryKey: ["students"],
    queryFn: async () => (await listStudents()) as Student[],
  });

  const { data: blocked = [] } = useQuery({
    queryKey: ["blocks"],
    queryFn: async () => (await listBlocks()).map((b) => b.blocked_id),
  });

  async function startChat(otherId: string) {
    try {
      await startDirectChat({ data: { otherId } });
      toast.success("Private conversation ready.");
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      void navigate({ to: "/messages" });
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  async function toggleBlock(otherId: string) {
    try {
      const result = await toggleBlockFn({ data: { otherId } });
      toast.success(result.blocked ? "Blocked." : "Unblocked.");
      void queryClient.invalidateQueries({ queryKey: ["blocks"] });
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  async function report(otherId: string) {
    const reason = window.prompt("Why are you reporting this student?");
    if (!reason) return;
    try {
      await createReport({
        data: { targetType: "user", targetId: otherId, reason: reason.slice(0, 500) },
      });
      toast.success("Report sent to the moderators.");
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  const term = q.trim().toLowerCase();
  const visible = students.filter(
    (s) =>
      s.id !== user?.id &&
      (!term ||
        s.display_name.toLowerCase().includes(term) ||
        (s.programme ?? "").toLowerCase().includes(term) ||
        (s.department ?? "").toLowerCase().includes(term)),
  );

  return (
    <>
      <PageHeader
        title="Students"
        description="Find classmates and start a private conversation."
      />
      <div className="space-y-5 p-4 md:p-8">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, programme or department"
            value={q}
            maxLength={80}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((s) => {
            const initials = s.display_name
              ? s.display_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
              : "ST";

            return (
              <Card
                key={s.id}
                className="transition-shadow hover:shadow-md cursor-pointer"
                onClick={() => setSelectedStudent(s)}
              >
                <CardContent className="flex items-start gap-3 p-5">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={s.avatar_url ?? undefined} alt={s.display_name} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium hover:underline">{s.display_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.programme ?? "Student"}
                      {s.level ? ` · Level ${s.level}` : ""}
                    </p>
                    {blocked.includes(s.id) && (
                      <Badge variant="destructive" className="mt-2">
                        Blocked
                      </Badge>
                    )}
                    <div
                      className="mt-3 flex flex-wrap gap-2"
                      onClick={(e) => e.stopPropagation()} // Prevents dialog opening when clicking action buttons
                    >
                      <Button size="sm" onClick={() => startChat(s.id)}>
                        <MessagesSquare className="mr-2 h-4 w-4" />
                        Message
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleBlock(s.id)}>
                        <Ban className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => report(s.id)}>
                        <Flag className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Student Profile Modal */}
      <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
        <DialogContent className="sm:max-w-md">
          {selectedStudent && (
            <>
              <DialogHeader className="flex flex-col items-center gap-3 text-center">
                {/* Increased size from h-20 w-20 to h-32 w-32 */}
                <Avatar className="h-32 w-32 shadow-md">
                  <AvatarImage
                    src={selectedStudent.avatar_url ?? undefined}
                    alt={selectedStudent.display_name}
                    className="object-cover"
                  />
                  <AvatarFallback className="text-2xl font-bold">
                    {selectedStudent.display_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-2xl font-semibold">
                    {selectedStudent.display_name}
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-sm text-muted-foreground">
                    {selectedStudent.programme ?? "Student"}
                    {selectedStudent.level ? ` · Level ${selectedStudent.level}` : ""}
                  </DialogDescription>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-2 text-sm">
                {selectedStudent.department && (
                  <div>
                    <span className="font-semibold text-muted-foreground">Department:</span>
                    <p>{selectedStudent.department}</p>
                  </div>
                )}
                {selectedStudent.bio && (
                  <div>
                    <span className="font-semibold text-muted-foreground">About:</span>
                    <p className="whitespace-pre-wrap">{selectedStudent.bio}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  onClick={() => {
                    const id = selectedStudent.id;
                    setSelectedStudent(null);
                    startChat(id);
                  }}
                >
                  <MessagesSquare className="mr-2 h-4 w-4" />
                  Message
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
