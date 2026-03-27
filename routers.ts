import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import { storagePut } from "./storage";
import {
  listSchools,
  getSchoolById,
  createSchool,
  updateSchool,
  deleteSchool,
  listTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  listConversations,
  getConversationById,
  createConversation,
  updateConversationTitle,
  deleteConversation,
  listMessages,
  createMessage,
  getStats,
} from "./db";

// ─── Admin guard ──────────────────────────────────────────────────────────────

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores." });
  }
  return next({ ctx });
});

// ─── Schools router ───────────────────────────────────────────────────────────

const schoolsRouter = router({
  list: publicProcedure.query(() => listSchools()),

  getById: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) =>
    getSchoolById(input.id)
  ),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        city: z.string().optional(),
        state: z.string().optional(),
        logoUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await createSchool(input);
      await notifyOwner({
        title: "Nova escola cadastrada",
        content: `A escola "${input.name}" foi cadastrada no sistema.`,
      });
      return { success: true };
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        logoUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateSchool(id, data);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteSchool(input.id);
      return { success: true };
    }),
});

// ─── Teachers router ──────────────────────────────────────────────────────────

const teachersRouter = router({
  list: publicProcedure
    .input(z.object({ schoolId: z.number().optional() }).optional())
    .query(({ input }) => listTeachers(input?.schoolId)),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getTeacherById(input.id)),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        subject: z.string().min(1),
        bio: z.string().optional(),
        avatarUrl: z.string().optional(),
        schoolId: z.number().optional(),
        systemPrompt: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await createTeacher(input);
      await notifyOwner({
        title: "Novo professor cadastrado",
        content: `O professor "${input.name}" (${input.subject}) foi cadastrado no sistema.`,
      });
      return { success: true };
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        subject: z.string().optional(),
        bio: z.string().optional(),
        avatarUrl: z.string().optional(),
        schoolId: z.number().optional(),
        systemPrompt: z.string().optional(),
        active: z.enum(["yes", "no"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateTeacher(id, data);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteTeacher(input.id);
      return { success: true };
    }),

  uploadAvatar: adminProcedure
    .input(
      z.object({
        teacherId: z.number(),
        fileName: z.string(),
        fileBase64: z.string(),
        mimeType: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const key = `teacher-avatars/${input.teacherId}-${Date.now()}-${input.fileName}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      await updateTeacher(input.teacherId, { avatarUrl: url });
      return { url };
    }),
});

// ─── Chat router ──────────────────────────────────────────────────────────────

const chatRouter = router({
  listConversations: protectedProcedure
    .input(z.object({ teacherId: z.number().optional() }))
    .query(({ ctx, input }) => listConversations(ctx.user.id, input.teacherId)),

  getMessages: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(async ({ ctx, input }) => {
      const conv = await getConversationById(input.conversationId);
      if (!conv || conv.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return listMessages(input.conversationId);
    }),

  newConversation: protectedProcedure
    .input(z.object({ teacherId: z.number(), title: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const teacher = await getTeacherById(input.teacherId);
      if (!teacher) throw new TRPCError({ code: "NOT_FOUND", message: "Professor não encontrado." });
      const conv = await createConversation({
        userId: ctx.user.id,
        teacherId: input.teacherId,
        title: input.title ?? `Conversa com ${teacher.name}`,
      });
      return conv;
    }),

  deleteConversation: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const conv = await getConversationById(input.conversationId);
      if (!conv || conv.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await deleteConversation(input.conversationId);
      return { success: true };
    }),

  sendMessage: protectedProcedure
    .input(
      z.object({
        conversationId: z.number(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const conv = await getConversationById(input.conversationId);
      if (!conv || conv.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const teacher = await getTeacherById(conv.teacherId);
      if (!teacher) throw new TRPCError({ code: "NOT_FOUND" });

      // Save user message
      await createMessage({
        conversationId: input.conversationId,
        role: "user",
        content: input.content,
      });

      // Build message history for LLM
      const history = await listMessages(input.conversationId);
      const systemPrompt =
        teacher.systemPrompt ||
        `Você é ${teacher.name}, um(a) professor(a) especialista em ${teacher.subject}. 
Você é um assistente educacional inteligente, paciente e didático. 
Responda sempre em português brasileiro de forma clara e educativa.
Quando apropriado, use exemplos práticos, analogias e estruture bem suas respostas.`;

      const llmMessages = [
        { role: "system" as const, content: systemPrompt },
        ...history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      const response = await invokeLLM({ messages: llmMessages });
      const rawContent = response.choices?.[0]?.message?.content;
      const assistantContent =
        typeof rawContent === "string" ? rawContent : "Desculpe, não consegui gerar uma resposta.";

      // Save assistant message
      await createMessage({
        conversationId: input.conversationId,
        role: "assistant",
        content: assistantContent,
      });

      // Auto-update title on first exchange
      if (history.length <= 1) {
        const shortTitle = input.content.slice(0, 60) + (input.content.length > 60 ? "…" : "");
        await updateConversationTitle(input.conversationId, shortTitle);
      }

      return { content: assistantContent };
    }),

  generateContent: protectedProcedure
    .input(
      z.object({
        type: z.enum(["document", "html", "slides_outline", "image_prompt"]),
        prompt: z.string().min(1),
        teacherId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      let systemPrompt = "Você é um assistente educacional especialista em criação de conteúdo.";

      if (input.teacherId) {
        const teacher = await getTeacherById(input.teacherId);
        if (teacher) {
          systemPrompt = `Você é ${teacher.name}, professor(a) de ${teacher.subject}. Crie conteúdo educacional de alta qualidade.`;
        }
      }

      const typeInstructions: Record<string, string> = {
        document: "Crie um documento educacional completo em Markdown com títulos, subtítulos e conteúdo detalhado.",
        html: "Crie um documento HTML completo e bem formatado com estilos CSS inline. Retorne apenas o HTML.",
        slides_outline: "Crie um roteiro detalhado de apresentação de slides em Markdown, com título de cada slide e pontos principais.",
        image_prompt: "Crie um prompt detalhado em inglês para geração de imagem educacional relacionada ao tema.",
      };

      const response = await invokeLLM({
        messages: [
          { role: "system", content: `${systemPrompt} ${typeInstructions[input.type]}` },
          { role: "user", content: input.prompt },
        ],
      });

      const raw = response.choices?.[0]?.message?.content;
      return { content: typeof raw === "string" ? raw : "" };
    }),
});

// ─── Stats router ─────────────────────────────────────────────────────────────

const statsRouter = router({
  overview: adminProcedure.query(() => getStats()),
});

// ─── App router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  schools: schoolsRouter,
  teachers: teachersRouter,
  chat: chatRouter,
  stats: statsRouter,
});

export type AppRouter = typeof appRouter;
