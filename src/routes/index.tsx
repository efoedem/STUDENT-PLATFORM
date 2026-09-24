import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  MessagesSquare,
  ShieldCheck,
  Users,
  FileText,
  Bell,
  GraduationCap,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EDEM — Student Academic & Social Platform" },
      {
        name: "description",
        content:
          "Sign in to EDEM to reach lecture notes, past questions and course group chats. Talk openly or anonymously, safely.",
      },
      { property: "og:title", content: "EDEM — Student Academic & Social Platform" },
      {
        property: "og:description",
        content:
          "Course materials, past questions and campus conversations in one student platform. Identified or anonymous, your choice.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: BookOpen,
    title: "Digital library",
    text: "Lecture notes, slides and past questions organised by course, level and year.",
  },
  {
    icon: MessagesSquare,
    title: "Course group chats",
    text: "Every course you enrol in opens its own discussion room with your classmates.",
  },
  {
    icon: EyeOff,
    title: "Anonymous mode",
    text: "Ask the question you were afraid to ask. Your name never leaves your account.",
  },
  {
    icon: FileText,
    title: "Reviewed uploads",
    text: "Students share materials; moderators approve them before anyone downloads.",
  },
  {
    icon: Users,
    title: "Private messages",
    text: "Reach any classmate directly, and block or report anyone who crosses the line.",
  },
  {
    icon: Bell,
    title: "Stay in the loop",
    text: "Announcements, replies and new materials for your courses, all in one feed.",
  },
];

function Landing() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">EDEM</span>
          </Link>
          <nav className="flex items-center gap-2">
            {!loading && user ? (
              <Button asChild>
                <Link to="/dashboard">Go to dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button asChild>
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Create account
                  </Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" />
            Built for students, moderated for safety
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
            Your coursework and your campus conversations, in one place.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            EDEM brings lecture notes, past questions and classmates together. Speak as yourself, or
            switch to anonymous when the question is easier asked without a name attached.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link to="/auth" search={{ mode: "signup" }}>
                Create your student account
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/auth">I already have an account</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-semibold md:text-3xl">Everything a student needs</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border/60 bg-secondary/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold md:text-3xl">
              Anonymous, but never unaccountable
            </h2>
            <p className="mt-4 text-sm text-muted-foreground md:text-base">
              When you post anonymously, other students only see a alias for that conversation, such
              as "Anonymous Student 482". Your name, student number and photo stay hidden, and your
              alias is different in every room so nobody can follow you around.
            </p>
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              Everyone still signs in with a real account. Serious reports of harassment or abuse
              can be investigated by administrators, so anonymity protects privacy without becoming
              a shield for misconduct.
            </p>
          </div>
          <ul className="space-y-3 self-center">
            {[
              "Clear indicator of your mode before every message",
              "Report and block controls in every conversation",
              "Private conversations readable only by their members",
              "Uploaded files reviewed before they go public",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-sm"
              >
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>EDEM Student Platform</span>
          <Link to="/auth" className="hover:text-foreground">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
