import { Elysia, t } from "elysia";
import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { encrypt, decrypt } from "@/lib/crypto";
import {
  getQueueInstance, getJobCounts, getJobs, getJobById, retryJob, removeJob, getJobLogs,
  promoteJob,
  pauseQueue,
  resumeQueue,
  emptyQueue,
  addJob,
  retryAll,
  promoteAll,
} from "@/lib/queue-helper";

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
  .get("/queue/:id/counts", async ({ params: { id }, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    // Fetch the queue from database
    const queueConfig = await prisma.queue.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        redisConfig: true,
      },
    });

    if (!queueConfig) {
      throw new Error("Queue not found");
    }

    try {
      const queue = await getQueueInstance(queueConfig.name, queueConfig.redisConfig);
      const counts = await getJobCounts(queue);
      return { success: true, data: counts };
    } catch (error: any) {
      return { success: false, message: error.message || "Failed to fetch job counts" };
    }
  })
  .get("/queue/:id/jobs/:status", async ({ params: { id, status }, query, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    const start = parseInt(query.start as string || "0");
    const end = parseInt(query.end as string || "50");

    // Fetch the queue from database
    const queueConfig = await prisma.queue.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        redisConfig: true,
      },
    });

    if (!queueConfig) {
      throw new Error("Queue not found");
    }

    try {
      const queue = await getQueueInstance(queueConfig.name, queueConfig.redisConfig);
      const jobs = await getJobs(queue, status, start, end);

      // Serialize jobs to plain objects
      const serializedJobs = await Promise.all(
        jobs.map(async (job) => ({
          id: job.id,
          name: job.name,
          data: job.data,
          progress: job.progress,
          timestamp: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          failedReason: job.failedReason,
          stacktrace: job.stacktrace,
          returnvalue: job.returnvalue,
          attemptsMade: job.attemptsMade,
          delay: job.delay,
          opts: job.opts,
        }))
      );

      return { success: true, data: serializedJobs };
    } catch (error: any) {
      return { success: false, message: error.message || "Failed to fetch jobs" };
    }
  })
  .get("/queue/:id/job/:jobId", async ({ params: { id, jobId }, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    // Fetch the queue from database
    const queueConfig = await prisma.queue.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        redisConfig: true,
      },
    });

    if (!queueConfig) {
      throw new Error("Queue not found");
    }

    try {
      const queue = await getQueueInstance(queueConfig.name, queueConfig.redisConfig);
      const job = await getJobById(queue, jobId);

      if (!job) {
        return { success: false, message: "Job not found" };
      }

      // Serialize job to plain object
      const serializedJob = {
        id: job.id,
        name: job.name,
        data: job.data,
        progress: job.progress,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
        stacktrace: job.stacktrace,
        returnvalue: job.returnvalue,
        attemptsMade: job.attemptsMade,
        delay: job.delay,
        opts: job.opts,
      };

      return { success: true, data: serializedJob };
    } catch (error: any) {
      return { success: false, message: error.message || "Failed to fetch job" };
    }
  })
  .post("/queue/:id/job/:jobId/retry", async ({ params: { id, jobId }, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    // Fetch the queue from database
    const queueConfig = await prisma.queue.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        redisConfig: true,
      },
    });

    if (!queueConfig) {
      throw new Error("Queue not found");
    }

    try {
      const queue = await getQueueInstance(queueConfig.name, queueConfig.redisConfig);
      await retryJob(queue, jobId);
      return { success: true, message: "Job retried successfully" };
    } catch (error: any) {
      return { success: false, message: error.message || "Failed to retry job" };
    }
  })
  .post("/queue/:id/job/:jobId/promote", async ({ params: { id, jobId }, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    // Fetch the queue from database
    const queueConfig = await prisma.queue.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        redisConfig: true,
      },
    });

    if (!queueConfig) {
      throw new Error("Queue not found");
    }

    try {
      const queue = await getQueueInstance(queueConfig.name, queueConfig.redisConfig);
      await promoteJob(queue, jobId);
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message || "Failed to promote job" };
    }
  })
  .get("/queue/:id/job/:jobId/logs", async ({ params: { id, jobId }, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    // Fetch the queue from database
    const queueConfig = await prisma.queue.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        redisConfig: true,
      },
    });

    if (!queueConfig) {
      throw new Error("Queue not found");
    }

    try {
      const queue = await getQueueInstance(queueConfig.name, queueConfig.redisConfig);
      const logs = await getJobLogs(queue, jobId);
      return { success: true, data: logs };
    } catch (error: any) {
      return { success: false, message: error.message || "Failed to fetch job logs" };
    }
  })
  .post("/queue/:id/pause", async ({ params: { id }, request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw new Error("Unauthorized");

    const queueConfig = await prisma.queue.findUnique({
      where: { id, userId: session.user.id },
      include: { redisConfig: true },
    });
    if (!queueConfig) throw new Error("Queue not found");

    try {
      const queue = await getQueueInstance(queueConfig.name, queueConfig.redisConfig);
      await pauseQueue(queue);
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message || "Failed to pause queue" };
    }
  })
  .post("/queue/:id/resume", async ({ params: { id }, request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw new Error("Unauthorized");

    const queueConfig = await prisma.queue.findUnique({
      where: { id, userId: session.user.id },
      include: { redisConfig: true },
    });
    if (!queueConfig) throw new Error("Queue not found");

    try {
      const queue = await getQueueInstance(queueConfig.name, queueConfig.redisConfig);
      await resumeQueue(queue);
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message || "Failed to resume queue" };
    }
  })
  .post("/queue/:id/empty", async ({ params: { id }, request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw new Error("Unauthorized");

    const queueConfig = await prisma.queue.findUnique({
      where: { id, userId: session.user.id },
      include: { redisConfig: true },
    });
    if (!queueConfig) throw new Error("Queue not found");

    try {
      const queue = await getQueueInstance(queueConfig.name, queueConfig.redisConfig);
      await emptyQueue(queue);
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message || "Failed to empty queue" };
    }
  })
  .post("/queue/:id/add", async ({ params: { id }, request, body }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw new Error("Unauthorized");

    const { name, data, opts } = body as { name: string; data: any; opts?: any };

    const queueConfig = await prisma.queue.findUnique({
      where: { id, userId: session.user.id },
      include: { redisConfig: true },
    });
    if (!queueConfig) throw new Error("Queue not found");

    try {
      const queue = await getQueueInstance(queueConfig.name, queueConfig.redisConfig);
      await addJob(queue, name, data, opts);
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message || "Failed to add job" };
    }
  })
  .post("/queue/:id/retry-all", async ({ params: { id }, request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw new Error("Unauthorized");

    const queueConfig = await prisma.queue.findUnique({
      where: { id, userId: session.user.id },
      include: { redisConfig: true },
    });
    if (!queueConfig) throw new Error("Queue not found");

    try {
      const queue = await getQueueInstance(queueConfig.name, queueConfig.redisConfig);
      await retryAll(queue);
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message || "Failed to retry all jobs" };
    }
  })
  .post("/queue/:id/promote-all", async ({ params: { id }, request }) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw new Error("Unauthorized");

    const queueConfig = await prisma.queue.findUnique({
      where: { id, userId: session.user.id },
      include: { redisConfig: true },
    });
    if (!queueConfig) throw new Error("Queue not found");

    try {
      const queue = await getQueueInstance(queueConfig.name, queueConfig.redisConfig);
      await promoteAll(queue);
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message || "Failed to promote all jobs" };
    }
  })
  .delete("/queue/:id/job/:jobId", async ({ params: { id, jobId }, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    // Fetch the queue from database
    const queueConfig = await prisma.queue.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        redisConfig: true,
      },
    });

    if (!queueConfig) {
      throw new Error("Queue not found");
    }

    try {
      const queue = await getQueueInstance(queueConfig.name, queueConfig.redisConfig);
      await removeJob(queue, jobId);
      return { success: true, message: "Job removed successfully" };
    } catch (error: any) {
      return { success: false, message: error.message || "Failed to remove job" };
    }
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
