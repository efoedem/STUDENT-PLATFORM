import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Camera, Loader2 } from "lucide-react";

import {
  changePassword as changePasswordFn,
  updateProfile,
  uploadAvatar,
} from "@/lib/api.functions";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { errMessage } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile & settings — EDEM" },
      { name: "description", content: "Update your student details and password." },
      { property: "og:title", content: "Profile & settings — EDEM" },
      { property: "og:description", content: "Manage your EDEM account." },
    ],
  }),
  component: ProfilePage,
});

const schema = z.object({
  display_name: z.string().trim().min(2, "Enter your name").max(80),
  student_number: z.string().trim().max(40).optional(),
  programme: z.string().trim().max(120).optional(),
  department: z.string().trim().max(120).optional(),
  level: z.string().trim().max(4).optional(),
  bio: z.string().trim().max(500).optional(),
});

function ProfilePage() {
  const { profile, roles, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    display_name: "",
    student_number: "",
    programme: "",
    department: "",
    level: "",
    bio: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name ?? "",
        student_number: profile.student_number ?? "",
        programme: profile.programme ?? "",
        department: profile.department ?? "",
        level: profile.level ? String(profile.level) : "",
        bio: profile.bio ?? "",
      });
    }
  }, [profile]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size must be less than 5MB.");
      return;
    }

    setUploadingAvatar(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(",")[1];
          if (!base64Data) {
            reject(new Error("Failed to process image file format."));
            return;
          }
          resolve(base64Data);
        };
        reader.onerror = () => reject(new Error("Failed to read image file."));
        reader.readAsDataURL(file);
      });

      await uploadAvatar({
        data: {
          fileName: file.name,
          dataBase64: base64,
        },
      });

      toast.success("Avatar updated successfully.");
      await refresh();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    setBusy(true);
    try {
      await updateProfile({ data: parsed.data });
      toast.success("Profile saved.");
      await refresh();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next.length < 8) {
      toast.error("Use at least 8 characters.");
      return;
    }
    setPwBusy(true);
    try {
      await changePasswordFn({ data: { current: pw.current, next: pw.next } });
      toast.success("Password updated.");
      setPw({ current: "", next: "" });
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setPwBusy(false);
    }
  }

  const initials = form.display_name
    ? form.display_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "ST";

  return (
    <>
      <PageHeader title="Profile & settings" description="Your details and account security." />
      <div className="grid max-w-3xl gap-6 p-4 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile Photo</CardTitle>
            <CardDescription>Upload an avatar to personalize your account.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <div className="relative group">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile?.avatar_url ?? undefined} alt={form.display_name} />
                <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
              </Avatar>
              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={uploadingAvatar}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingAvatar ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Camera className="mr-2 h-4 w-4" />
                    Change Avatar
                  </>
                )}
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">JPG, PNG or WEBP. 5MB max size.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Student details</CardTitle>
            <CardDescription>
              Shown to classmates when you post with your name visible.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={save}>
              <div className="flex flex-wrap gap-2">
                {roles.map((r) => (
                  <Badge key={r} variant="secondary">
                    {r}
                  </Badge>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor="display_name">Display name</Label>
                <Input
                  id="display_name"
                  value={form.display_name}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="student_number">Student number</Label>
                  <Input
                    id="student_number"
                    value={form.student_number}
                    maxLength={40}
                    onChange={(e) => setForm({ ...form, student_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="level">Level</Label>
                  <Input
                    id="level"
                    inputMode="numeric"
                    value={form.level}
                    maxLength={4}
                    onChange={(e) => setForm({ ...form, level: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="programme">Programme</Label>
                  <Input
                    id="programme"
                    value={form.programme}
                    maxLength={120}
                    onChange={(e) => setForm({ ...form, programme: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={form.department}
                    maxLength={120}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">About you</Label>
                <Textarea
                  id="bio"
                  value={form.bio}
                  maxLength={500}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                />
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change password</CardTitle>
            <CardDescription>Enter your current password to set a new one.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={changePassword}>
              <div className="space-y-2">
                <Label htmlFor="current">Current password</Label>
                <Input
                  id="current"
                  type="password"
                  autoComplete="current-password"
                  value={pw.current}
                  onChange={(e) => setPw({ ...pw, current: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="next">New password</Label>
                <Input
                  id="next"
                  type="password"
                  autoComplete="new-password"
                  value={pw.next}
                  maxLength={200}
                  onChange={(e) => setPw({ ...pw, next: e.target.value })}
                />
              </div>
              <Button type="submit" variant="outline" disabled={pwBusy}>
                {pwBusy ? "Updating…" : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Privacy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              When you post anonymously, other students only see a per-conversation alias. Your
              name, student number and email are never attached to those messages.
            </p>
            <p>
              Administrators can investigate serious abuse reports, so anonymity protects your
              privacy from classmates but does not place you beyond the platform rules.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
