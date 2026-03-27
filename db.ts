import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  schools,
  teachers,
  conversations,
  messages,
  InsertSchool,
  InsertTeacher,
  InsertConversation,
  InsertMessage,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);

  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Schools ─────────────────────────────────────────────────────────────────

export async function listSchools() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(schools).orderBy(schools.name);
}

export async function getSchoolById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(schools).where(eq(schools.id, id)).limit(1);
  return result[0];
}

export async function createSchool(data: InsertSchool) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(schools).values(data);
  return result[0];
}

export async function updateSchool(id: number, data: Partial<InsertSchool>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(schools).set(data).where(eq(schools.id, id));
}

export async function deleteSchool(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(schools).where(eq(schools.id, id));
}

// ─── Teachers ────────────────────────────────────────────────────────────────

export async function listTeachers(schoolId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (schoolId) {
    return db.select().from(teachers).where(eq(teachers.schoolId, schoolId)).orderBy(teachers.name);
  }
  return db.select().from(teachers).orderBy(teachers.name);
}

export async function getTeacherById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(teachers).where(eq(teachers.id, id)).limit(1);
  return result[0];
}

export async function createTeacher(data: InsertTeacher) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(teachers).values(data);
  return result[0];
}

export async function updateTeacher(id: number, data: Partial<InsertTeacher>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(teachers).set(data).where(eq(teachers.id, id));
}

export async function deleteTeacher(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(teachers).where(eq(teachers.id, id));
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function listConversations(userId: number, teacherId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (teacherId) {
    return db
      .select()
      .from(conversations)
      .where(and(eq(conversations.userId, userId), eq(conversations.teacherId, teacherId)))
      .orderBy(desc(conversations.updatedAt));
  }
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt));
}

export async function getConversationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  return result[0];
}

export async function createConversation(data: InsertConversation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(conversations).values(data);
  const result = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.userId, data.userId), eq(conversations.teacherId, data.teacherId)))
    .orderBy(desc(conversations.createdAt))
    .limit(1);
  return result[0];
}

export async function updateConversationTitle(id: number, title: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(conversations).set({ title }).where(eq(conversations.id, id));
}

export async function deleteConversation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(messages).where(eq(messages.conversationId, id));
  await db.delete(conversations).where(eq(conversations.id, id));
}

// ─── Messages ────────────────────────────────────────────────────────────────

export async function listMessages(conversationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);
}

export async function createMessage(data: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(messages).values(data);
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export async function getStats() {
  const db = await getDb();
  if (!db) return { teachers: 0, schools: 0, conversations: 0, users: 0 };
  const [teacherCount, schoolCount, convCount, userCount] = await Promise.all([
    db.select().from(teachers),
    db.select().from(schools),
    db.select().from(conversations),
    db.select().from(users),
  ]);
  return {
    teachers: teacherCount.length,
    schools: schoolCount.length,
    conversations: convCount.length,
    users: userCount.length,
  };
}
