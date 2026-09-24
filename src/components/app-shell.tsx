import { useState, useRef, useEffect, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  MessagesSquare,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { listConversations, signOut as signOutFn, unreadCount } from "@/lib/api.functions";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/courses", label: "Courses", icon: BookOpen },
  { to: "/materials", label: "Materials", icon: Library },
  { to: "/messages", label: "Messages", icon: MessagesSquare },
  { to: "/students", label: "Students", icon: Users },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/profile", label: "Profile", icon: Settings },
] as const;

// Global Audio Chime Synthesizer
function triggerGlobalAudio() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const audioCtx = new AudioCtx();

    const playSound = () => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5

      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    };

    if (audioCtx.state === "suspended") {
      audioCtx
        .resume()
        .then(() => playSound())
        .catch(() => {});
    } else {
      playSound();
    }
  } catch (err) {
    console.error("Audio trigger error:", err);
  }
}
export function AppShell({ children }: { children: ReactNode }) {
  const { profile, isStaff, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const prevUnreadMessagesRef = useRef<number>(0);

  // Ask for browser notification permission on load
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  // 1. Unread notifications count
  const { data: unread = 0 } = useQuery({
    queryKey: ["unread-notifications", user?.id],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: () => unreadCount(),
  });

  // 2. Global Unread Messages Polling (Runs continuously across all routes/pages)
  const { data: conversations = [] } = useQuery({
    queryKey: ["global-conversations", user?.id],
    enabled: !!user,
    refetchInterval: 3000, // Polls every 3s
    queryFn: async () => {
      try {
        return (await listConversations()) as Array<{ unread_count?: number }>;
      } catch {
        return [];
      }
    },
  });

  // Calculate incoming unread messages count
  const unreadMessagesCount = conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);

  // Trigger sound alert & pop-up toast globally when an incoming message arrives
  useEffect(() => {
    if (
      unreadMessagesCount > prevUnreadMessagesRef.current &&
      prevUnreadMessagesRef.current !== 0
    ) {
      triggerGlobalAudio();

      toast.message("New message received", {
        description: "You have unread messages in your chat inbox.",
        action: {
          label: "View",
          onClick: () => void navigate({ to: "/messages" }),
        },
      });

      if ("Notification" in window && Notification.permission === "granted") {
        const notification = new Notification("New Message — EDEM", {
          body: "You received a new message.",
          icon: "/favicon.ico",
        });

        notification.onclick = () => {
          window.focus();
          void navigate({ to: "/messages" });
        };
      }
    }
    prevUnreadMessagesRef.current = unreadMessagesCount;
  }, [unreadMessagesCount, navigate]);

  async function signOut() {
    await signOutFn();
    await queryClient.cancelQueries();
    queryClient.clear();
    void navigate({ to: "/auth", replace: true });
  }

  const initials = (profile?.display_name ?? "S")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const nav = (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const active = pathname.startsWith(item.to);

        let badgeCount = 0;
        if (item.to === "/notifications") badgeCount = unread;
        if (item.to === "/messages") badgeCount = unreadMessagesCount;

        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            <span className="flex-1">{item.label}</span>
            {badgeCount > 0 && (
              <Badge className="h-5 min-w-5 justify-center bg-accent px-1 text-accent-foreground">
                {badgeCount}
              </Badge>
            )}
          </Link>
        );
      })}
      {isStaff && (
        <Link
          to="/admin"
          onClick={() => setOpen(false)}
          className={cn(
            "mt-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
            pathname.startsWith("/admin")
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          )}
        >
          <ShieldCheck className="h-4 w-4" />
          Admin
        </Link>
      )}
    </nav>
  );

  const sidebarInner = (
    <div className="flex h-full flex-col bg-sidebar p-4 text-sidebar-foreground">
      <Link to="/dashboard" className="mb-6 flex items-center gap-2" onClick={() => setOpen(false)}>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <GraduationCap className="h-5 w-5" />
        </span>
        <span className="font-display text-lg font-semibold">EDEM</span>
      </Link>
      {nav}
      <div className="mt-auto space-y-3 pt-6">
        <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/50 p-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{profile?.display_name ?? "Student"}</p>
            <p className="truncate text-xs text-sidebar-foreground/60">
              {profile?.programme ?? "EDEM student"}
            </p>
          </div>
        </div>
        <Button variant="ghost" className="w-full justify-start gap-3" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border md:block">
        <div className="sticky top-0 h-screen">{sidebarInner}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-none p-0">
              {sidebarInner}
            </SheetContent>
          </Sheet>
          <span className="font-display font-semibold">EDEM</span>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-card px-4 py-5 md:px-8">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
