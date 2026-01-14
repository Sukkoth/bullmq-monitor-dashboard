import { Elysia, t } from "elysia";
import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { encrypt, decrypt } from "@/lib/crypto";

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

    const configs = await prisma.redisConfig.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return configs.map(config => ({
      ...config,
      password: config.password ? "__ENCRYPTED__" : null
    }));
  })
  .post("/redis/test", async ({ body }) => {
    const { host, port, username, password, db, tls } = body;
    const redis = new Redis({
      host,
      port,
      username: username || undefined,
      password: password || undefined,
      db,
      tls: tls ? {} : undefined,
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
      username: t.Optional(t.String()),
      password: t.Optional(t.String()),
      db: t.Number(),
      tls: t.Optional(t.Boolean()),
    }),
  })
  .post("/redis/config", async ({ body, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    const { name, host, port, username, password, db, tls } = body;

    const config = await prisma.redisConfig.create({
      data: {
        name,
        host,
        port,
        username: username || null,
        password: password ? encrypt(password) : null,
        db,
        tls: !!tls,
        userId: session.user.id,
      },
    });

    return { success: true, data: config };
  }, {
    body: t.Object({
      name: t.String({ minLength: 1 }),
      host: t.String({ minLength: 1 }),
      port: t.Number(),
      username: t.Optional(t.String()),
      password: t.Optional(t.String()),
      db: t.Number(),
      tls: t.Optional(t.Boolean()),
    }),
  })
  .patch("/redis/config/:id", async ({ params: { id }, body, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    const { name, host, port, username, password, db, tls } = body;

    const dataToUpdate: any = {
      name,
      host,
      port,
      db,
      tls,
      username: username === undefined ? undefined : (username || null),
    };

    if (password !== undefined) {
      if (password === "__ENCRYPTED__") {
        // Don't update password if it's the placeholder
      } else {
        dataToUpdate.password = password ? encrypt(password) : null;
      }
    }

    const config = await prisma.redisConfig.update({
      where: {
        id,
        userId: session.user.id,
      },
      data: dataToUpdate,
    });

    return { success: true, data: config };
  }, {
    body: t.Object({
      name: t.Optional(t.String({ minLength: 1 })),
      host: t.Optional(t.String({ minLength: 1 })),
      port: t.Optional(t.Number()),
      username: t.Optional(t.String()),
      password: t.Optional(t.String()),
      db: t.Optional(t.Number()),
      tls: t.Optional(t.Boolean()),
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
  .get("/queue", async ({ request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    const queues = await prisma.queue.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        redisConfig: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return queues;
  })
  .post("/queue", async ({ body, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    const { name, displayName, note, tags, pollingDuration, redisConfigId } = body;

    // Verify the redis config belongs to the user
    const redisConfig = await prisma.redisConfig.findUnique({
      where: {
        id: redisConfigId,
        userId: session.user.id,
      },
    });

    if (!redisConfig) {
      return { success: false, message: "Redis configuration not found" };
    }

    const queue = await prisma.queue.create({
      data: {
        name,
        displayName,
        note: note || null,
        tags: JSON.stringify(tags || []),
        pollingDuration: pollingDuration || 0,
        redisConfigId,
        userId: session.user.id,
      },
      include: {
        redisConfig: true,
      },
    });

    return { success: true, data: queue };
  }, {
    body: t.Object({
      name: t.String({ minLength: 1, maxLength: 100 }),
      displayName: t.String({ minLength: 1, maxLength: 100 }),
      note: t.Optional(t.String({ maxLength: 500 })),
      tags: t.Optional(t.Array(t.String())),
      pollingDuration: t.Optional(t.Number({ minimum: 0 })),
      redisConfigId: t.String(),
    }),
  })
  .patch("/queue/:id", async ({ params: { id }, body, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    const { name, displayName, note, tags, pollingDuration, redisConfigId } = body;

    // If redisConfigId is being updated, verify it belongs to the user
    if (redisConfigId) {
      const redisConfig = await prisma.redisConfig.findUnique({
        where: {
          id: redisConfigId,
          userId: session.user.id,
        },
      });

      if (!redisConfig) {
        return { success: false, message: "Redis configuration not found" };
      }
    }

    const dataToUpdate: any = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (displayName !== undefined) dataToUpdate.displayName = displayName;
    if (note !== undefined) dataToUpdate.note = note || null;
    if (tags !== undefined) dataToUpdate.tags = JSON.stringify(tags);
    if (pollingDuration !== undefined) dataToUpdate.pollingDuration = pollingDuration;
    if (redisConfigId !== undefined) dataToUpdate.redisConfigId = redisConfigId;

    const queue = await prisma.queue.update({
      where: {
        id,
        userId: session.user.id,
      },
      data: dataToUpdate,
      include: {
        redisConfig: true,
      },
    });

    return { success: true, data: queue };
  }, {
    body: t.Object({
      name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
      displayName: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
      note: t.Optional(t.String({ maxLength: 500 })),
      tags: t.Optional(t.Array(t.String())),
      pollingDuration: t.Optional(t.Number({ minimum: 0 })),
      redisConfigId: t.Optional(t.String()),
    }),
  })
  .delete("/queue/:id", async ({ params: { id }, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    await prisma.queue.delete({
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
      username: config.username || undefined,
      password: config.password ? decrypt(config.password) : undefined,
      db: config.db,
      tls: config.tls ? {} : undefined,
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
