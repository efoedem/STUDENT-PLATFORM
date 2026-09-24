import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeOff, Flag, Send, ShieldCheck, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

import { createReport, listConversations, listMessages, sendMessage } from "@/lib/api.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, errMessage } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { title: "Messages — EDEM" },
      {
        name: "description",
        content: "Course group chats and private messages, identified or anonymous.",
      },
      { property: "og:title", content: "Messages — EDEM" },
      { property: "og:description", content: "Chat with classmates on EDEM." },
    ],
  }),
  component: Messages,
});

type Conversation = { id: string; type: string; title: string; alias: string };

type Msg = {
  id: string;
  body: string;
  mode: "identified" | "anonymous";
  sender_name: string | null;
  mine: boolean;
  created_at: string;
};

// Create audio instance with fallback beep if no audio file exists
function triggerAudioChime() {
  try {
    const audioCtx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
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
  } catch (err) {
    console.error("Audio trigger error:", err);
  }
}

function Messages() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessagesCountRef = useRef<number>(0);

  // Ask for OS-level browser notification permissions
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => (await listConversations()) as Conversation[],
  });

  useEffect(() => {
    if (!activeId && conversations.length) setActiveId(conversations[0]!.id);
  }, [conversations, activeId]);

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", activeId],
    enabled: !!activeId,
    refetchInterval: 2000,
    refetchIntervalInBackground: true, // Guarantees polling continues when tab is hidden/minimized
    queryFn: async () =>
      (await listMessages({ data: { conversationId: activeId! } })) as unknown as Msg[],
  });

  // Incoming message listener
  useEffect(() => {
    if (messages.length > prevMessagesCountRef.current && prevMessagesCountRef.current !== 0) {
      const latestMsg = messages[messages.length - 1];

      if (latestMsg && !latestMsg.mine) {
        // Play sound chime
        triggerAudioChime();

        const sender =
          latestMsg.sender_name ?? (latestMsg.mode === "anonymous" ? "Anonymous" : "Student");

        // In-App Toast
        toast.message(`New message from ${sender}`, {
          description: latestMsg.body,
        });

        // WhatsApp-style OS Notification
        if ("Notification" in window && Notification.permission === "granted") {
          const notification = new Notification(`Message from ${sender}`, {
            body: latestMsg.body,
            icon: "/favicon.ico",
            silent: false,
          });

          notification.onclick = () => {
            window.focus();
          };
        }
      }
    }
    prevMessagesCountRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const active = conversations.find((c) => c.id === activeId);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !activeId) return;
    setSending(true);
    try {
      await sendMessage({
        data: { conversationId: activeId, body, mode: anonymous ? "anonymous" : "identified" },
      });
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: ["messages", activeId] });
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setSending(false);
    }
  }

  async function reportMessage(id: string) {
    const reason = window.prompt("Why are you reporting this message?");
    if (!reason) return;
    try {
      await createReport({
        data: { targetType: "message", targetId: id, reason: reason.slice(0, 500) },
      });
      toast.success("Report sent to the moderators.");
    } catch (err) {
      toast.error(errMessage(err));
    }
  }

  return (
    <div className="flex h-[calc(100vh-56px)] md:h-screen">
      <aside
        className={cn(
          "w-full shrink-0 overflow-y-auto border-r border-border bg-card md:w-72",
          activeId && "hidden md:block",
        )}
      >
        <div className="border-b border-border p-4">
          <h1 className="text-lg font-semibold">Conversations</h1>
          <p className="text-xs text-muted-foreground">
            Course groups appear when you enrol in a course.
          </p>
        </div>
        {conversations.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            No conversations yet. Enrol in a course or message a classmate.
          </p>
        )}
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveId(c.id)}
            className={cn(
              "flex w-full items-center gap-3 border-b border-border/60 p-4 text-left transition-colors hover:bg-secondary/60",
              activeId === c.id && "bg-secondary",
            )}
          >
            <Avatar className="h-9 w-9">
              <AvatarFallback className="text-xs">
                {c.title.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{c.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {c.type === "course" ? "Course group" : c.type === "direct" ? "Private" : "Group"}
              </p>
            </div>
          </button>
        ))}
      </aside>

      <section className={cn("flex min-w-0 flex-1 flex-col", !activeId && "hidden md:flex")}>
        {active ? (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
              <div className="min-w-0">
                <button
                  className="text-xs text-muted-foreground md:hidden"
                  onClick={() => setActiveId(null)}
                >
                  ← All conversations
                </button>
                <h2 className="truncate text-base font-semibold">{active.title}</h2>
                <p className="text-xs text-muted-foreground">
                  Your alias here: <span className="font-medium">{active.alias}</span>
                </p>
              </div>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto bg-background p-4">
              {messages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">
                  No messages yet. Start the conversation.
                </p>
              )}
              {messages.map((m) => {
                const mine = m.mine;
                const name = m.sender_name ?? (m.mode === "anonymous" ? "Anonymous" : "Student");
                return (
                  <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "group max-w-[80%] rounded-xl px-4 py-2.5 text-sm",
                        mine
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-card text-card-foreground",
                      )}
                    >
                      <div className="mb-1 flex items-center gap-2 text-xs opacity-80">
                        {m.mode === "anonymous" ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <UserIcon className="h-3 w-3" />
                        )}
                        <span className="font-medium">{name}</span>
                        <span>
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {!mine && (
                          <button
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={() => reportMessage(m.id)}
                            aria-label="Report message"
                          >
                            <Flag className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-border bg-card p-4">
              <div
                className={cn(
                  "mb-3 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs",
                  anonymous
                    ? "border-accent/50 bg-accent/10 text-accent-foreground"
                    : "border-border bg-secondary/50 text-muted-foreground",
                )}
              >
                <span className="flex items-center gap-2">
                  {anonymous ? <EyeOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                  {anonymous ? (
                    <>
                      Sending as <strong>{active.alias}</strong> — your name stays hidden from other
                      students.
                    </>
                  ) : (
                    <>Sending with your name visible to everyone in this conversation.</>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Label htmlFor="anon" className="text-xs">
                    Anonymous
                  </Label>
                  <Switch id="anon" checked={anonymous} onCheckedChange={setAnonymous} />
                </span>
              </div>
              <form className="flex gap-2" onSubmit={send}>
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a message…"
                  maxLength={2000}
                />
                <Button type="submit" disabled={sending || !draft.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
              {anonymous && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Anonymity hides you from other students, not from administrators investigating
                  serious abuse reports.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <div>
              <Badge variant="secondary" className="mb-3">
                Nothing selected
              </Badge>
              <p className="text-sm text-muted-foreground">
                Pick a conversation to start reading and replying.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
