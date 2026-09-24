import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { q, q1 } from "./db.server";
import { requireStaff, requireUser } from "./middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
// session.server pulls in server-only runtime APIs, so it is imported lazily
// inside handlers (handler bodies never reach the browser bundle).
const session = () => import("./session.server");

/* --------------------------------- helpers ---------------------------------- */

async function makeAlias(conversationId: string) {
  for (let i = 0; i < 40; i++) {
    const candidate = `Anonymous Student ${100 + Math.floor(Math.random() * 900)}`;
    const clash = await q1(
      `select 1 from conversation_members where conversation_id = $1 and alias = $2`,
      [conversationId, candidate],
    );
    if (!clash) return candidate;
  }
  return `Anonymous Student ${Date.now().toString().slice(-6)}`;
}

async function joinConversation(conversationId: string, userId: string) {
  const existing = await q1(
    `select id from conversation_members where conversation_id = $1 and user_id = $2`,
    [conversationId, userId],
  );
  if (existing) return;
  const alias = await makeAlias(conversationId);
  await q(
    `insert into conversation_members (conversation_id, user_id, alias)
     values ($1,$2,$3) on conflict (conversation_id, user_id) do nothing`,
    [conversationId, userId, alias],
  );
}

async function courseConversation(courseId: string) {
  const found = await q1<{ id: string }>(
    `select id from conversations where course_id = $1 and type = 'course' limit 1`,
    [courseId],
  );
  if (found) return found.id;
  const course = await q1<{ code: string; title: string }>(
    `select code, title from courses where id = $1`,
    [courseId],
  );
  const created = await q1<{ id: string }>(
    `insert into conversations (type, title, course_id) values ('course', $1, $2) returning id`,
    [`${course?.code ?? "Course"} — ${course?.title ?? ""}`.trim(), courseId],
  );
  return created!.id;
}

async function assertMember(conversationId: string, userId: string) {
  const member = await q1<{ alias: string }>(
    `select alias from conversation_members where conversation_id = $1 and user_id = $2`,
    [conversationId, userId],
  );
  if (!member) throw new Error("You are not a member of this conversation.");
  return member;
}

/* ----------------------------------- auth ----------------------------------- */

const signUpSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(2).max(80),
  studentNumber: z.string().trim().max(40).optional(),
  programme: z.string().trim().max(120).optional(),
  department: z.string().trim().max(120).optional(),
  level: z.string().trim().max(4).optional(),
});

export const signUp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => signUpSchema.parse(d))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const existing = await q1(`select id from users where lower(email) = $1`, [email]);
    if (existing) throw new Error("An account with that email already exists.");

    const hash = await (await session()).hashPassword(data.password);
    const user = await q1<{ id: string }>(
      `insert into users (email, password_hash) values ($1,$2) returning id`,
      [email, hash],
    );
    const id = user!.id;
    await q(
      `insert into profiles (id, display_name, student_number, programme, department, level)
       values ($1,$2,$3,$4,$5,$6)`,
      [
        id,
        data.displayName,
        data.studentNumber || null,
        data.programme || null,
        data.department || null,
        data.level ? Number(data.level) : null,
      ],
    );
    const count = await q1<{ n: string }>(`select count(*)::text as n from users`);
    // The very first account becomes the administrator.
    const role = Number(count?.n ?? "1") <= 1 ? "admin" : "student";
    await q(`insert into user_roles (user_id, role) values ($1,$2) on conflict do nothing`, [
      id,
      role,
    ]);
    await (await session()).startSession(id);
    return { ok: true, role };
  });

export const signIn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ email: z.string().trim().email(), password: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const user = await q1<{ id: string; password_hash: string }>(
      `select id, password_hash from users where lower(email) = $1`,
      [data.email.toLowerCase()],
    );
    if (!user || !(await (await session()).verifyPassword(data.password, user.password_hash))) {
      throw new Error("Wrong email or password.");
    }
    const profile = await q1<{ status: string }>(`select status from profiles where id = $1`, [
      user.id,
    ]);
    if (profile?.status === "suspended") throw new Error("Your account has been suspended.");
    await (await session()).startSession(user.id);
    return { ok: true };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  await (await session()).endSession();
  return { ok: true };
});

export const me = createServerFn({ method: "GET" }).handler(async () => {
  const viewer = await (await session()).loadViewer();
  if (!viewer) return null;
  const profile = await q1(`select * from profiles where id = $1`, [viewer.userId]);
  return {
    user: { id: viewer.userId, email: viewer.email },
    profile,
    roles: viewer.roles,
    isStaff: viewer.isStaff,
    isAdmin: viewer.isAdmin,
  };
});

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) =>
    z
      .object({
        display_name: z.string().trim().min(2).max(80),
        student_number: z.string().trim().max(40).optional(),
        programme: z.string().trim().max(120).optional(),
        department: z.string().trim().max(120).optional(),
        level: z.string().trim().max(4).optional(),
        bio: z.string().trim().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await q(
      `update profiles set display_name=$2, student_number=$3, programme=$4, department=$5,
        level=$6, bio=$7, updated_at=now() where id=$1`,
      [
        context.viewer.userId,
        data.display_name,
        data.student_number || null,
        data.programme || null,
        data.department || null,
        data.level ? Number(data.level) : null,
        data.bio || null,
      ],
    );
    return { ok: true };
  });

export const changePassword = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) =>
    z.object({ current: z.string().min(1), next: z.string().min(8).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const user = await q1<{ password_hash: string }>(
      `select password_hash from users where id = $1`,
      [context.viewer.userId],
    );
    if (!user || !(await (await session()).verifyPassword(data.current, user.password_hash))) {
      throw new Error("Your current password is not correct.");
    }
    await q(`update users set password_hash = $2 where id = $1`, [
      context.viewer.userId,
      await (await session()).hashPassword(data.next),
    ]);
    return { ok: true };
  });
/* ---------------------------------- avatar ---------------------------------- */

export const uploadAvatar = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) =>
    z
      .object({
        fileName: z.string().min(1),
        dataBase64: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const userId = context.viewer.userId;
    const fileExt = data.fileName.split(".").pop() || "png";
    const filePath = `${userId}/${Date.now()}.${fileExt}`;

    const buffer = Buffer.from(data.dataBase64, "base64");

    const { error: uploadError } = await supabaseAdmin.storage
      .from("avatars")
      .upload(filePath, buffer, {
        contentType: `image/${fileExt === "jpg" ? "jpeg" : fileExt}`,
        upsert: true,
      });

    if (uploadError) throw new Error(uploadError.message);

    const { data: publicData } = supabaseAdmin.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const avatarUrl = publicData.publicUrl;

    await q(`update profiles set avatar_url = $2, updated_at = now() where id = $1`, [
      userId,
      avatarUrl,
    ]);

    return { ok: true, avatarUrl };
  });

/* ---------------------------------- courses --------------------------------- */

export const listCourses = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async () => q(`select * from courses order by code`));

export const listEnrolments = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) =>
    q<{ course_id: string }>(`select course_id from enrolments where user_id = $1`, [
      context.viewer.userId,
    ]),
  );

export const enrol = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) => z.object({ courseId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await q(`insert into enrolments (user_id, course_id) values ($1,$2) on conflict do nothing`, [
      context.viewer.userId,
      data.courseId,
    ]);
    const conv = await courseConversation(data.courseId);
    await joinConversation(conv, context.viewer.userId);
    return { ok: true };
  });

export const unenrol = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) => z.object({ courseId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await q(`delete from enrolments where user_id = $1 and course_id = $2`, [
      context.viewer.userId,
      data.courseId,
    ]);
    await q(
      `delete from conversation_members cm using conversations c
        where cm.conversation_id = c.id and c.course_id = $2 and c.type='course' and cm.user_id = $1`,
      [context.viewer.userId, data.courseId],
    );
    return { ok: true };
  });

/* --------------------------------- materials -------------------------------- */

export const listMaterials = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) =>
    q(
      `select m.*, c.code as course_code, c.title as course_title
         from materials m left join courses c on c.id = m.course_id
        where m.status = 'approved' or m.uploader_id = $1 or $2
        order by m.created_at desc
        limit 300`,
      [context.viewer.userId, context.viewer.isStaff],
    ),
  );

export const listBookmarks = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) =>
    q<{ material_id: string }>(`select material_id from bookmarks where user_id = $1`, [
      context.viewer.userId,
    ]),
  );

export const toggleBookmark = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) => z.object({ materialId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const existing = await q1(`select id from bookmarks where user_id=$1 and material_id=$2`, [
      context.viewer.userId,
      data.materialId,
    ]);
    if (existing) {
      await q(`delete from bookmarks where user_id=$1 and material_id=$2`, [
        context.viewer.userId,
        data.materialId,
      ]);
    } else {
      await q(`insert into bookmarks (user_id, material_id) values ($1,$2)`, [
        context.viewer.userId,
        data.materialId,
      ]);
    }
    return { ok: true };
  });

export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

export const uploadMaterial = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().trim().min(3).max(140),
        description: z.string().trim().max(1000).optional(),
        academicYear: z.string().trim().max(20).optional(),
        category: z.string().trim().max(40),
        courseId: z.string().uuid().nullable().optional(),
        fileName: z.string().trim().min(1).max(200),
        mimeType: z.string().trim().max(120),
        fileSize: z.number().int().positive().max(MAX_UPLOAD_BYTES),
        dataBase64: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const material = await q1<{ id: string }>(
      `insert into materials
        (course_id, title, description, category, academic_year, file_name, file_size, mime_type, uploader_id, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending') returning id`,
      [
        data.courseId ?? null,
        data.title,
        data.description || null,
        data.category,
        data.academicYear || null,
        data.fileName,
        data.fileSize,
        data.mimeType,
        context.viewer.userId,
      ],
    );
    await q(`insert into material_files (material_id, data) values ($1, decode($2,'base64'))`, [
      material!.id,
      data.dataBase64,
    ]);
    return { ok: true, id: material!.id };
  });

/* ---------------------------------- reports --------------------------------- */

export const createReport = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) =>
    z
      .object({
        targetType: z.enum(["material", "message", "user"]),
        targetId: z.string().uuid(),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await q(
      `insert into reports (reporter_id, target_type, target_id, reason) values ($1,$2,$3,$4)`,
      [context.viewer.userId, data.targetType, data.targetId, data.reason],
    );
    return { ok: true };
  });

/* ----------------------------------- chat ----------------------------------- */

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) =>
    q(
      `select cm.conversation_id as id,
              c.type,
              cm.alias,
              coalesce(
                case when c.type = 'direct'
                  then (select p.display_name from conversation_members o
                          join profiles p on p.id = o.user_id
                         where o.conversation_id = c.id and o.user_id <> $1 limit 1)
                  else c.title end,
                'Conversation') as title
         from conversation_members cm
         join conversations c on c.id = cm.conversation_id
        where cm.user_id = $1
        order by c.type, title`,
      [context.viewer.userId],
    ),
  );

export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) => z.object({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMember(data.conversationId, context.viewer.userId);
    return q(
      `select m.id, m.conversation_id, m.body, m.mode, m.created_at, m.alias,
              case when m.mode = 'identified' then m.sender_id else null end as sender_id,
              case when m.mode = 'identified' then p.display_name else m.alias end as sender_name,
              (m.author_id = $2) as mine
         from messages m left join profiles p on p.id = m.sender_id
        where m.conversation_id = $1
        order by m.created_at asc
        limit 300`,
      [data.conversationId, context.viewer.userId],
    );
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        body: z.string().trim().min(1).max(2000),
        mode: z.enum(["identified", "anonymous"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const member = await assertMember(data.conversationId, context.viewer.userId);
    await q(
      `insert into messages (conversation_id, body, mode, sender_id, alias, author_id)
       values ($1,$2,$3,$4,$5,$6)`,
      [
        data.conversationId,
        data.body,
        data.mode,
        data.mode === "identified" ? context.viewer.userId : null,
        data.mode === "anonymous" ? member.alias : null,
        context.viewer.userId,
      ],
    );
    return { ok: true };
  });

export const startDirectChat = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) => z.object({ otherId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.otherId === context.viewer.userId) throw new Error("You cannot message yourself.");
    const existing = await q1<{ id: string }>(
      `select c.id from conversations c
         join conversation_members a on a.conversation_id = c.id and a.user_id = $1
         join conversation_members b on b.conversation_id = c.id and b.user_id = $2
        where c.type = 'direct' limit 1`,
      [context.viewer.userId, data.otherId],
    );
    if (existing) return { id: existing.id };
    const conv = await q1<{ id: string }>(
      `insert into conversations (type, created_by) values ('direct',$1) returning id`,
      [context.viewer.userId],
    );
    await joinConversation(conv!.id, context.viewer.userId);
    await joinConversation(conv!.id, data.otherId);
    await q(
      `insert into notifications (user_id, type, title, body, link)
       values ($1,'message','New private conversation','A classmate started a chat with you.','/messages')`,
      [data.otherId],
    );
    return { id: conv!.id };
  });

/* --------------------------------- students --------------------------------- */

export const listStudents = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async () =>
    q(
      `select id, display_name, programme, department, level, avatar_url from profiles order by display_name limit 500`,
    ),
  );

export const listBlocks = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) =>
    q<{ blocked_id: string }>(`select blocked_id from blocks where blocker_id = $1`, [
      context.viewer.userId,
    ]),
  );

export const toggleBlock = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .inputValidator((d: unknown) => z.object({ otherId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const existing = await q1(`select id from blocks where blocker_id=$1 and blocked_id=$2`, [
      context.viewer.userId,
      data.otherId,
    ]);
    if (existing) {
      await q(`delete from blocks where blocker_id=$1 and blocked_id=$2`, [
        context.viewer.userId,
        data.otherId,
      ]);
      return { blocked: false };
    }
    await q(`insert into blocks (blocker_id, blocked_id) values ($1,$2)`, [
      context.viewer.userId,
      data.otherId,
    ]);
    return { blocked: true };
  });

/* ------------------------------- notifications ------------------------------ */

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) =>
    q(`select * from notifications where user_id=$1 order by created_at desc limit 100`, [
      context.viewer.userId,
    ]),
  );

export const unreadCount = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const row = await q1<{ n: string }>(
      `select count(*)::text as n from notifications where user_id=$1 and read = false`,
      [context.viewer.userId],
    );
    return Number(row?.n ?? "0");
  });

export const markAllRead = createServerFn({ method: "POST" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    await q(`update notifications set read = true where user_id=$1 and read = false`, [
      context.viewer.userId,
    ]);
    return { ok: true };
  });

/* --------------------------------- dashboard -------------------------------- */

export const dashboard = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const uid = context.viewer.userId;
    const [courses, materials, announcements, convRow, unreadRow] = await Promise.all([
      q(
        `select c.id, c.code, c.title, c.level from enrolments e join courses c on c.id = e.course_id
          where e.user_id = $1 order by c.code`,
        [uid],
      ),
      q(
        `select m.id, m.title, m.category, m.created_at, c.code as course_code
           from materials m left join courses c on c.id = m.course_id
          where m.status = 'approved' order by m.created_at desc limit 5`,
      ),
      q(`select id, title, body, created_at from announcements order by created_at desc limit 3`),
      q1<{ n: string }>(`select count(*)::text as n from conversation_members where user_id = $1`, [
        uid,
      ]),
      q1<{ n: string }>(
        `select count(*)::text as n from notifications where user_id = $1 and read = false`,
        [uid],
      ),
    ]);
    return {
      courses,
      materials,
      announcements,
      conversationCount: Number(convRow?.n ?? "0"),
      unread: Number(unreadRow?.n ?? "0"),
    };
  });

/* ----------------------------------- admin ---------------------------------- */

export const adminPending = createServerFn({ method: "GET" })
  .middleware([requireStaff])
  .handler(async () =>
    q(`select * from materials where status = 'pending' order by created_at asc`),
  );

export const adminDecide = createServerFn({ method: "POST" })
  .middleware([requireStaff])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["approved", "rejected"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const material = await q1<{ uploader_id: string; title: string }>(
      `update materials set status = $2 where id = $1 returning uploader_id, title`,
      [data.id, data.status],
    );
    if (material) {
      await q(
        `insert into notifications (user_id, type, title, body, link)
         values ($1,'material',$2,$3,'/materials')`,
        [
          material.uploader_id,
          data.status === "approved" ? "Your upload was approved" : "Your upload was rejected",
          material.title,
        ],
      );
    }
    return { ok: true };
  });

export const adminReports = createServerFn({ method: "GET" })
  .middleware([requireStaff])
  .handler(async () => q(`select * from reports order by created_at desc limit 100`));

export const adminResolveReport = createServerFn({ method: "POST" })
  .middleware([requireStaff])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await q(`update reports set status='resolved', resolution_note=$2 where id=$1`, [
      data.id,
      `Handled by ${context.viewer.email}`,
    ]);
    return { ok: true };
  });

export const adminPeople = createServerFn({ method: "GET" })
  .middleware([requireStaff])
  .handler(async () =>
    q(
      `select p.id, p.display_name, p.student_number, p.programme, p.status, p.avatar_url,
              coalesce((select string_agg(role::text, ', ') from user_roles r where r.user_id = p.id), 'student') as roles
         from profiles p order by p.display_name limit 300`,
    ),
  );

export const adminToggleSuspend = createServerFn({ method: "POST" })
  .middleware([requireStaff])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!context.viewer.isAdmin) throw new Error("Only administrators can do that.");
    const row = await q1<{ status: string }>(
      `update profiles set status = case when status = 'suspended' then 'active' else 'suspended' end
        where id = $1 returning status`,
      [data.id],
    );
    return { status: row?.status ?? "active" };
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireStaff])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), role: z.enum(["student", "moderator", "admin"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!context.viewer.isAdmin) throw new Error("Only administrators can change roles.");
    await q(`delete from user_roles where user_id = $1`, [data.id]);
    await q(`insert into user_roles (user_id, role) values ($1,$2) on conflict do nothing`, [
      data.id,
      data.role,
    ]);
    return { ok: true };
  });

export const adminAddCourse = createServerFn({ method: "POST" })
  .middleware([requireStaff])
  .inputValidator((d: unknown) =>
    z
      .object({
        code: z.string().trim().min(2).max(20),
        title: z.string().trim().min(3).max(150),
        level: z.string().trim().max(4).optional(),
        department: z.string().trim().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await q(`insert into courses (code, title, level, department) values ($1,$2,$3,$4)`, [
      data.code.toUpperCase(),
      data.title,
      data.level ? Number(data.level) : null,
      data.department || null,
    ]);
    return { ok: true };
  });

export const adminPostAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireStaff])
  .inputValidator((d: unknown) =>
    z
      .object({ title: z.string().trim().min(3).max(150), body: z.string().trim().max(1000) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await q(`insert into announcements (title, body, author_id) values ($1,$2,$3)`, [
      data.title,
      data.body,
      context.viewer.userId,
    ]);
    await q(
      `insert into notifications (user_id, type, title, body, link)
       select id, 'announcement', $1, $2, '/notifications' from users`,
      [data.title, data.body.slice(0, 200)],
    );
    return { ok: true };
  });
