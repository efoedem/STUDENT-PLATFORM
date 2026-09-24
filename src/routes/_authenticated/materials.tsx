import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, Download, Flag, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import {
  createReport,
  listBookmarks,
  listCourses,
  listMaterials,
  toggleBookmark as toggleBookmarkFn,
  uploadMaterial,
} from "@/lib/api.functions";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errMessage } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/materials")({
  head: () => ({
    meta: [
      { title: "Materials — EDEM" },
      {
        name: "description",
        content: "Lecture notes, past questions and slides shared by students and staff.",
      },
      { property: "og:title", content: "Materials — EDEM" },
      { property: "og:description", content: "Find and share course materials on EDEM." },
    ],
  }),
  component: Materials,
});

const CATEGORIES = [
  { value: "notes", label: "Lecture notes" },
  { value: "past_question", label: "Past questions" },
  { value: "slides", label: "Slides" },
  { value: "assignment", label: "Assignment" },
  { value: "other", label: "Other" },
];

const uploadSchema = z.object({
  title: z.string().trim().min(3, "Give the material a title").max(140),
  description: z.string().trim().max(1000).optional(),
  academicYear: z.string().trim().max(20).optional(),
});

const ALLOWED = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
];

const MAX_BYTES = 6 * 1024 * 1024;

type Material = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  academic_year: string | null;
  status: string;
  uploader_id: string;
  file_name: string;
  course_code: string | null;
  course_title: string | null;
};

function readAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

function Materials() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    academicYear: "",
    category: "notes",
    courseId: "none",
  });
  const [file, setFile] = useState<File | null>(null);

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => (await listCourses()) as { id: string; code: string; title: string }[],
  });

  const { data: materials = [] } = useQuery({
    queryKey: ["materials"],
    queryFn: async () => (await listMaterials()) as Material[],
  });

  const { data: bookmarks = [] } = useQuery({
    queryKey: ["bookmarks"],
    queryFn: async () => (await listBookmarks()).map((b) => b.material_id),
  });

  const toggleBookmark = useMutation({
    mutationFn: (materialId: string) => toggleBookmarkFn({ data: { materialId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
    onError: (e) => toast.error(errMessage(e)),
  });

  function download(id: string) {
    window.open(`/api/files/${id}`, "_blank", "noopener");
  }

  async function report(materialId: string) {
    const reason = window.prompt("Why are you reporting this material?");
    if (!reason) return;
    try {
      await createReport({
        data: { targetType: "material", targetId: materialId, reason: reason.slice(0, 500) },
      });
      toast.success("Report sent to the moderators.");
    } catch (e) {
      toast.error(errMessage(e));
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const parsed = uploadSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the details");
      return;
    }
    if (!file) {
      toast.error("Choose a file to upload");
      return;
    }
    if (!ALLOWED.includes(file.type)) {
      toast.error("Use a PDF, document, slide deck, image or text file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Files must be 6MB or smaller.");
      return;
    }
    setBusy(true);
    try {
      const dataBase64 = await readAsBase64(file);
      await uploadMaterial({
        data: {
          title: parsed.data.title,
          description: parsed.data.description,
          academicYear: parsed.data.academicYear,
          category: form.category,
          courseId: form.courseId === "none" ? null : form.courseId,
          fileName: file.name.replace(/[^a-zA-Z0-9._ -]/g, "_"),
          mimeType: file.type,
          fileSize: file.size,
          dataBase64,
        },
      });
      toast.success("Uploaded. A moderator will review it before it appears publicly.");
      setOpen(false);
      setFile(null);
      setForm({ title: "", description: "", academicYear: "", category: "notes", courseId: "none" });
      void queryClient.invalidateQueries({ queryKey: ["materials"] });
    } catch (err) {
      toast.error(errMessage(err, "Upload failed"));
    } finally {
      setBusy(false);
    }
  }

  const term = q.trim().toLowerCase();
  const visible = materials.filter((m) => {
    if (tab === "mine" && m.uploader_id !== user?.id) return false;
    if (tab === "saved" && !bookmarks.includes(m.id)) return false;
    if (tab === "all" && m.status !== "approved") return false;
    if (category !== "all" && m.category !== category) return false;
    if (!term) return true;
    return (
      m.title.toLowerCase().includes(term) ||
      (m.description ?? "").toLowerCase().includes(term) ||
      (m.course_code ?? "").toLowerCase().includes(term) ||
      (m.course_title ?? "").toLowerCase().includes(term)
    );
  });

  return (
    <>
      <PageHeader
        title="Materials"
        description="Notes, past questions and slides. Student uploads appear after review."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Share a material</DialogTitle>
                <DialogDescription>
                  Only upload files you are allowed to share. A moderator reviews every upload.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleUpload}>
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={form.title}
                    maxLength={140}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    maxLength={1000}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={form.category}
                      onValueChange={(v) => setForm({ ...form, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year">Academic year</Label>
                    <Input
                      id="year"
                      placeholder="2025/2026"
                      value={form.academicYear}
                      maxLength={20}
                      onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Course</Label>
                  <Select
                    value={form.courseId}
                    onValueChange={(v) => setForm({ ...form, courseId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a course" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific course</SelectItem>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.code} — {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="file">File (max 6MB)</Label>
                  <Input
                    id="file"
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    required
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={busy}>
                    {busy ? "Uploading…" : "Submit for review"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="space-y-5 p-4 md:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all">Approved</TabsTrigger>
              <TabsTrigger value="saved">Saved</TabsTrigger>
              <TabsTrigger value="mine">My uploads</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search title, course code or keyword"
              value={q}
              maxLength={80}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {visible.length === 0 && <p className="text-sm text-muted-foreground">Nothing here yet.</p>}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((m) => {
            const saved = bookmarks.includes(m.id);
            return (
              <Card key={m.id}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold leading-snug">{m.title}</h3>
                    {m.status !== "approved" && (
                      <Badge variant={m.status === "pending" ? "secondary" : "destructive"}>
                        {m.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {m.course_code ?? "General"} · {m.category.replace("_", " ")}
                    {m.academic_year ? ` · ${m.academic_year}` : ""}
                  </p>
                  {m.description && (
                    <p className="line-clamp-3 text-sm text-muted-foreground">{m.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => download(m.id)}>
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleBookmark.mutate(m.id)}>
                      {saved ? (
                        <BookmarkCheck className="h-4 w-4" />
                      ) : (
                        <Bookmark className="h-4 w-4" />
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => report(m.id)}>
                      <Flag className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
