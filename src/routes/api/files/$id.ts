import { createFileRoute } from "@tanstack/react-router";

import { q1 } from "@/lib/db.server";
import { loadViewer } from "@/lib/session.server";

export const Route = createFileRoute("/api/files/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const viewer = await loadViewer();
        if (!viewer) return new Response("Sign in to download materials.", { status: 401 });

        const material = await q1<{
          file_name: string;
          mime_type: string | null;
          status: string;
          uploader_id: string;
          b64: string;
        }>(
          `select m.file_name, m.mime_type, m.status, m.uploader_id, encode(f.data,'base64') as b64
             from materials m join material_files f on f.material_id = m.id
            where m.id = $1`,
          [params.id],
        );
        if (!material) return new Response("Not found", { status: 404 });

        const allowed =
          material.status === "approved" ||
          material.uploader_id === viewer.userId ||
          viewer.isStaff;
        if (!allowed) return new Response("Not available", { status: 403 });

        const binary = atob(material.b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        return new Response(bytes, {
          headers: {
            "content-type": material.mime_type || "application/octet-stream",
            "content-disposition": `attachment; filename="${material.file_name.replace(/"/g, "")}"`,
            "cache-control": "private, no-store",
          },
        });
      },
    },
  },
});
