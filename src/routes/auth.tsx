import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { signIn, signUp } from "@/lib/api.functions";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ mode: z.enum(["signin", "signup"]).optional() }),
  head: () => ({
    meta: [
      { title: "Sign in — EDEM" },
      {
        name: "description",
        content: "Sign in or create your EDEM student account to reach course materials and chats.",
      },
      { property: "og:title", content: "Sign in — EDEM" },
      { property: "og:description", content: "Access your EDEM student account." },
    ],
  }),
  component: AuthPage,
});

const signUpSchema = z.object({
  displayName: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  studentNumber: z.string().trim().max(40).optional(),
  programme: z.string().trim().max(120).optional(),
  department: z.string().trim().max(120).optional(),
  level: z.string().trim().max(4).optional(),
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    studentNumber: "",
    programme: "",
    department: "",
    level: "",
  });

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/dashboard", replace: true });
  }, [loading, user, navigate]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const parsed = signUpSchema.safeParse(form);
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? "Check your details");
          return;
        }
        const result = await signUp({ data: parsed.data });
        toast.success(
          result.role === "admin"
            ? "Account created. You are the first account, so you have administrator access."
            : "Account created. Welcome to EDEM.",
        );
      } else {
        await signIn({ data: { email: form.email.trim(), password: form.password } });
        toast.success("Welcome back");
      }
      await queryClient.invalidateQueries();
      void navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(cleanMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-secondary/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-semibold">EDEM</span>
        </Link>
      </div>

      <div className="flex flex-1 items-start justify-center px-4 pb-16">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{mode === "signup" ? "Create your account" : "Sign in"}</CardTitle>
            <CardDescription>
              {mode === "signup"
                ? "Join EDEM to reach course materials and classmates."
                : "Welcome back to your student platform."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">Full name</Label>
                  <Input
                    id="displayName"
                    value={form.displayName}
                    onChange={set("displayName")}
                    maxLength={80}
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={set("email")}
                  maxLength={255}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={form.password}
                  onChange={set("password")}
                  maxLength={200}
                  required
                />
              </div>
              {mode === "signup" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="studentNumber">Student number</Label>
                    <Input
                      id="studentNumber"
                      value={form.studentNumber}
                      onChange={set("studentNumber")}
                      maxLength={40}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="level">Level</Label>
                    <Input
                      id="level"
                      inputMode="numeric"
                      placeholder="100"
                      value={form.level}
                      onChange={set("level")}
                      maxLength={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="programme">Programme</Label>
                    <Input
                      id="programme"
                      value={form.programme}
                      onChange={set("programme")}
                      maxLength={120}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={form.department}
                      onChange={set("department")}
                      maxLength={120}
                    />
                  </div>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "signup" ? "Create account" : "Sign in"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "signup" ? "Already have an account?" : "New to EDEM?"}{" "}
              <button
                type="button"
                className="font-medium text-foreground underline underline-offset-4"
                onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              >
                {mode === "signup" ? "Sign in" : "Create one"}
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function cleanMessage(err: unknown) {
  const raw = err instanceof Error ? err.message : "Something went wrong";
  return raw.replace(/^Error:\s*/i, "");
}
