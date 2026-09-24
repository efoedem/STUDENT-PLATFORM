import { createMiddleware } from "@tanstack/react-start";
import type { Viewer } from "./viewer";

/** Server-function middleware: rejects anyone who is not signed in. */
export const requireUser = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { loadViewer } = await import("./session.server");
  const viewer: Viewer | null = await loadViewer();
  if (!viewer) throw new Error("Unauthorized: please sign in again.");
  if (viewer.status === "suspended") throw new Error("Your account has been suspended.");
  return next({ context: { viewer } });
});

/** Server-function middleware: moderators and admins only. */
export const requireStaff = createMiddleware({ type: "function" })
  .middleware([requireUser])
  .server(async ({ next, context }) => {
    if (!context.viewer.isStaff) throw new Error("You do not have permission to do that.");
    return next({ context });
  });
