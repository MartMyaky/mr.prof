import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeAdminCtx(): { ctx: TrpcContext; clearedCookies: { name: string; options: Record<string, unknown> }[] } {
  const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@myaky.bot",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

function makeUserCtx(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@myaky.bot",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
  return { ctx };
}

function makeGuestCtx(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
  return { ctx };
}

// ─── Auth Tests ───────────────────────────────────────────────────────────────

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = makeAdminCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1 });
  });

  it("returns current user when authenticated", async () => {
    const { ctx } = makeAdminCtx();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).not.toBeNull();
    expect(user?.role).toBe("admin");
  });

  it("returns null for unauthenticated requests", async () => {
    const { ctx } = makeGuestCtx();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });
});

// ─── Schools Tests ────────────────────────────────────────────────────────────

describe("schools", () => {
  it("blocks non-admin from creating a school", async () => {
    const { ctx } = makeUserCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.schools.create({ name: "Test School" })
    ).rejects.toThrow();
  });

  it("blocks guest from creating a school", async () => {
    const { ctx } = makeGuestCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.schools.create({ name: "Test School" })
    ).rejects.toThrow();
  });

  it("blocks non-admin from deleting a school", async () => {
    const { ctx } = makeUserCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.schools.delete({ id: 1 })).rejects.toThrow();
  });
});

// ─── Teachers Tests ───────────────────────────────────────────────────────────

describe("teachers", () => {
  it("blocks non-admin from creating a teacher", async () => {
    const { ctx } = makeUserCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.teachers.create({ name: "Prof. Test", subject: "Math" })
    ).rejects.toThrow();
  });

  it("blocks guest from creating a teacher", async () => {
    const { ctx } = makeGuestCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.teachers.create({ name: "Prof. Test", subject: "Math" })
    ).rejects.toThrow();
  });

  it("blocks non-admin from deleting a teacher", async () => {
    const { ctx } = makeUserCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.teachers.delete({ id: 1 })).rejects.toThrow();
  });
});

// ─── Chat Tests ───────────────────────────────────────────────────────────────

describe("chat", () => {
  it("blocks guest from listing conversations", async () => {
    const { ctx } = makeGuestCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.chat.listConversations({ teacherId: undefined })).rejects.toThrow();
  });

  it("blocks guest from creating a new conversation", async () => {
    const { ctx } = makeGuestCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.chat.newConversation({ teacherId: 1 })).rejects.toThrow();
  });

  it("blocks guest from sending messages", async () => {
    const { ctx } = makeGuestCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.chat.sendMessage({ conversationId: 1, content: "Hello" })
    ).rejects.toThrow();
  });
});

// ─── Stats Tests ──────────────────────────────────────────────────────────────

describe("stats", () => {
  it("blocks non-admin from viewing stats", async () => {
    const { ctx } = makeUserCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.stats.overview()).rejects.toThrow();
  });

  it("blocks guest from viewing stats", async () => {
    const { ctx } = makeGuestCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.stats.overview()).rejects.toThrow();
  });
});
