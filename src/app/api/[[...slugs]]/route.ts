import { Elysia, t } from "elysia";
import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const app = new Elysia({ prefix: "/api" })
  .get("/", () => {
    return [
      {
        id: randomUUID(),
        name: "Queue1",
        displayName: "Queue 1",
      },
      {
        id: randomUUID(),
        name: "Queue2",
        displayName: "Queue 2",
      },
      {
        id: randomUUID(),
        name: "Queue3",
        displayName: "Queue 3",
      },
    ];
  })
  .post("/queue", ({ body }) => body, {
    body: t.Object({
      name: t.String({ minLength: 2, maxLength: 100 }),
      displayName: t.String({ minLength: 2, maxLength: 100 }),
    }),
  })
  .get("/redis/config", async ({ request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    return await prisma.redisConfig.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  })
  .post("/redis/test", async ({ body }) => {
    const { host, port, password, db } = body;
    const redis = new Redis({
      host,
      port,
      password: password || undefined,
      db,
      connectTimeout: 5000,
      retryStrategy: () => null, // Don't retry
    });

    try {
      await redis.ping();
      await redis.quit();
      return { success: true, message: "Connected successfully" };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }, {
    body: t.Object({
      host: t.String(),
      port: t.Number(),
      password: t.Optional(t.String()),
      db: t.Number(),
    }),
  })
  .post("/redis/config", async ({ body, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    const { name, host, port, password, db } = body;

    // Test connection first
    const redis = new Redis({
      host,
      port,
      password: password || undefined,
      db,
      connectTimeout: 5000,
      retryStrategy: () => null,
    });

    try {
      await redis.ping();
      await redis.quit();
    } catch (error: any) {
      throw new Error(`Connection failed: ${error.message}`);
    }

    const config = await prisma.redisConfig.create({
      data: {
        name,
        host,
        port,
        password: password || null,
        db,
        userId: session.user.id,
      },
    });

    return { success: true, data: config };
  }, {
    body: t.Object({
      name: t.String({ minLength: 1 }),
      host: t.String({ minLength: 1 }),
      port: t.Number(),
      password: t.Optional(t.String()),
      db: t.Number(),
    }),
  })
  .patch("/redis/config/:id", async ({ params: { id }, body, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    const { name, host, port, password, db } = body;

    const config = await prisma.redisConfig.update({
      where: {
        id,
        userId: session.user.id,
      },
      data: {
        name,
        host,
        port,
        password: password === undefined ? undefined : (password || null),
        db,
      },
    });

    return { success: true, data: config };
  }, {
    body: t.Object({
      name: t.Optional(t.String({ minLength: 1 })),
      host: t.Optional(t.String({ minLength: 1 })),
      port: t.Optional(t.Number()),
      password: t.Optional(t.String()),
      db: t.Optional(t.Number()),
    }),
  })
  .delete("/redis/config/:id", async ({ params: { id }, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    await prisma.redisConfig.delete({
      where: {
        id,
        userId: session.user.id,
      },
    });

    return { success: true };
  })
  .get("/redis/status/:id", async ({ params: { id }, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    const config = await prisma.redisConfig.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!config) {
      throw new Error("Config not found");
    }

    const redis = new Redis({
      host: config.host,
      port: config.port,
      password: config.password || undefined,
      db: config.db,
      connectTimeout: 2000,
      retryStrategy: () => null,
    });

    try {
      await redis.ping();
      await redis.quit();
      return { success: true, status: "online" };
    } catch (error) {
      return { success: true, status: "offline" };
    }
  });

export const GET = app.fetch;
export const POST = app.fetch;
export const PATCH = app.fetch;
export const DELETE = app.fetch;
