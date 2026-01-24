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
  duplicateJob,
  updateJobData,
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
  .get("/stats/dashboard", async ({ request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    const isShowingAll = session.user.role === "admin";
    const whereClause = isShowingAll ? {} : {
      OR: [
        { userId: session.user.id },
        { authorizedUsers: { some: { id: session.user.id } } }
      ]
    };

    const queues = await prisma.queue.findMany({
      where: whereClause,
      include: {
        redisConfig: true,
      },
    });

    const redisCount = await prisma.redisConfig.count({
      where: whereClause,
    });

    const totals = {
      active: 0,
      waiting: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
    };

    const queueDetails = [];

    for (const q of queues) {
      try {
        const queueInstance = await getQueueInstance(q.name, q.redisConfig);
        const counts = await getJobCounts(queueInstance);

        totals.active += counts.active;
        totals.waiting += counts.waiting;
        totals.completed += counts.completed;
        totals.failed += counts.failed;
        totals.delayed += counts.delayed;
        totals.paused += counts.paused;

        queueDetails.push({
          id: q.id,
          name: q.name,
          displayName: q.displayName,
          counts,
        });
      } catch (err) {
        console.error(`Error fetching stats for queue ${q.name}:`, err);
        // Skip queues that fail to connect for the global dashboard
      }
    }

    // Sort queues by failure count to show problematic ones first
    const topFailedQueues = [...queueDetails]
      .sort((a, b) => b.counts.failed - a.counts.failed)
      .slice(0, 5)
      .filter(q => q.counts.failed > 0);

    return {
      success: true,
      data: {
        totals,
        queueCount: queues.length,
        redisCount,
        topFailedQueues,
        allQueues: queueDetails,
      }
    };
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

    const isShowingAll = session.user.role === "admin";
    const whereClause = isShowingAll ? {} : {
      OR: [
        { userId: session.user.id },
        { authorizedUsers: { some: { id: session.user.id } } }
      ]
    };

    const configs = await prisma.redisConfig.findMany({
      where: whereClause,
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

    const config = await prisma.redisConfig.findFirst({
      where: {
        id,
        ...(session.user.role === "admin" ? {} : {
          OR: [
            { userId: session.user.id },
            { authorizedUsers: { some: { id: session.user.id } } }
          ]
        })
      }
    });

    if (!config) throw new Error("Connection not found");

    const updatedConfig = await prisma.redisConfig.update({
      where: { id },
      data: dataToUpdate,
    });

    return { success: true, data: updatedConfig };
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

    const config = await prisma.redisConfig.findFirst({
      where: {
        id,
        ...(session.user.role === "admin" ? {} : {
          OR: [
            { userId: session.user.id },
            { authorizedUsers: { some: { id: session.user.id } } }
          ]
        })
      }
    });

    if (!config) throw new Error("Connection not found");

    await prisma.redisConfig.delete({
      where: { id },
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

    const isShowingAll = session.user.role === "admin";
    const whereClause = isShowingAll ? {} : {
      OR: [
        { userId: session.user.id },
        { authorizedUsers: { some: { id: session.user.id } } }
      ]
    };

    const queues = await prisma.queue.findMany({
      where: whereClause,
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

    const { name, displayName, note, tags, redisConfigId } = body;

    // Verify the redis config belongs to the user
    const redisConfig = await prisma.redisConfig.findFirst({
      where: {
        id: redisConfigId,
        ...(session.user.role === "admin" ? {} : {
          OR: [
            { userId: session.user.id },
            { authorizedUsers: { some: { id: session.user.id } } }
          ]
        })
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

    const { name, displayName, note, tags, redisConfigId } = body;

    // If redisConfigId is being updated, verify it belongs to the user
    if (redisConfigId) {
      const redisConfig = await prisma.redisConfig.findUnique({
        where: {
          id: redisConfigId,
          ...(session.user.role === "admin" ? {} : { userId: session.user.id })
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
    if (redisConfigId !== undefined) dataToUpdate.redisConfigId = redisConfigId;

    const queue = await prisma.queue.findFirst({
      where: {
        id,
        ...(session.user.role === "admin" ? {} : {
          OR: [
            { userId: session.user.id },
            { authorizedUsers: { some: { id: session.user.id } } }
          ]
        })
      }
    });

    if (!queue) throw new Error("Queue not found");

    const updatedQueue = await prisma.queue.update({
      where: { id },
      data: dataToUpdate,
      include: {
        redisConfig: true,
      },
    });

    return { success: true, data: updatedQueue };
  }, {
    body: t.Object({
      name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
      displayName: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
      note: t.Optional(t.String({ maxLength: 500 })),
      tags: t.Optional(t.Array(t.String())),
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

    const queue = await prisma.queue.findFirst({
      where: {
        id,
        ...(session.user.role === "admin" ? {} : {
          OR: [
            { userId: session.user.id },
            { authorizedUsers: { some: { id: session.user.id } } }
          ]
        })
      }
    });

    if (!queue) throw new Error("Queue not found");

    await prisma.queue.delete({
      where: { id },
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
    const queueConfig = await prisma.queue.findFirst({
      where: {
        id,
        ...(session.user.role === "admin" ? {} : {
          OR: [
            { userId: session.user.id },
            { authorizedUsers: { some: { id: session.user.id } } }
          ]
        })
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
    const queueConfig = await prisma.queue.findFirst({
      where: {
        id,
        ...(session.user.role === "admin" ? {} : {
          OR: [
            { userId: session.user.id },
            { authorizedUsers: { some: { id: session.user.id } } }
          ]
        })
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
    const queueConfig = await prisma.queue.findFirst({
      where: {
        id,
        ...(session.user.role === "admin" ? {} : {
          OR: [
            { userId: session.user.id },
            { authorizedUsers: { some: { id: session.user.id } } }
          ]
        })
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
    const queueConfig = await prisma.queue.findFirst({
      where: {
        id,
        ...(session.user.role === "admin" ? {} : {
          OR: [
            { userId: session.user.id },
            { authorizedUsers: { some: { id: session.user.id } } }
          ]
        })
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
    const queueConfig = await prisma.queue.findFirst({
      where: {
        id,
        ...(session.user.role === "admin" ? {} : {
          OR: [
            { userId: session.user.id },
            { authorizedUsers: { some: { id: session.user.id } } }
          ]
        })
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
    const queueConfig = await prisma.queue.findFirst({
      where: {
        id,
        ...(session.user.role === "admin" ? {} : {
          OR: [
            { userId: session.user.id },
            { authorizedUsers: { some: { id: session.user.id } } }
          ]
        })
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
      where: { id, ...(session.user.role === "admin" ? {} : { userId: session.user.id }) },
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
      where: { id, ...(session.user.role === "admin" ? {} : { userId: session.user.id }) },
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
      where: { id, ...(session.user.role === "admin" ? {} : { userId: session.user.id }) },
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
      where: { id, ...(session.user.role === "admin" ? {} : { userId: session.user.id }) },
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
      where: { id, ...(session.user.role === "admin" ? {} : { userId: session.user.id }) },
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

    const queueConfig = await prisma.queue.findFirst({
      where: {
        id, ...(session.user.role === "admin" ? {} : {
          OR: [
            { userId: session.user.id },
            { authorizedUsers: { some: { id: session.user.id } } }
          ]
        })
      },
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
    const queueConfig = await prisma.queue.findFirst({
      where: {
        id,
        ...(session.user.role === "admin" ? {} : {
          OR: [
            { userId: session.user.id },
            { authorizedUsers: { some: { id: session.user.id } } }
          ]
        })
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
  .post("/queue/:id/job/:jobId/duplicate", async ({ params: { id, jobId }, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    const queueConfig = await prisma.queue.findFirst({
      where: {
        id,
        ...(session.user.role === "admin" ? {} : {
          OR: [
            { userId: session.user.id },
            { authorizedUsers: { some: { id: session.user.id } } }
          ]
        })
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
      const newJob = await duplicateJob(queue, jobId);
      return { success: true, data: { id: newJob.id }, message: "Job duplicated successfully" };
    } catch (error: any) {
      return { success: false, message: error.message || "Failed to duplicate job" };
    }
  })
  .patch("/queue/:id/job/:jobId/data", async ({ params: { id, jobId }, body, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    const queueConfig = await prisma.queue.findFirst({
      where: {
        id,
        ...(session.user.role === "admin" ? {} : {
          OR: [
            { userId: session.user.id },
            { authorizedUsers: { some: { id: session.user.id } } }
          ]
        })
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
      await updateJobData(queue, jobId, body.data);
      return { success: true, message: "Job data updated successfully" };
    } catch (error: any) {
      return { success: false, message: error.message || "Failed to update job data" };
    }
  }, {
    body: t.Object({
      data: t.Any(),
    }),
  })
  .get("/redis/status/:id", async ({ params: { id }, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      throw new Error("Unauthorized");
    }

    const config = await prisma.redisConfig.findFirst({
      where: {
        id,
        ...(session.user.role === "admin" ? {} : {
          OR: [
            { userId: session.user.id },
            { authorizedUsers: { some: { id: session.user.id } } }
          ]
        })
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
  })
  .get("/users", async ({ request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || session.user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return { success: true, data: users };
  })
  .patch("/users/:id/role", async ({ params: { id }, body, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || session.user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    try {
      await prisma.user.update({
        where: { id },
        data: { role: body.role },
      });
      return { success: true, message: "User role updated successfully" };
    } catch (error: any) {
      return { success: false, message: error.message || "Failed to update role" };
    }
  }, {
    body: t.Object({
      role: t.String(),
    }),
  })
  .delete("/users/:id", async ({ params: { id }, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || session.user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    try {
      if (session.user.id === id) {
        throw new Error("You cannot delete yourself");
      }
      await prisma.user.delete({
        where: { id },
      });
      return { success: true, message: "User deleted successfully" };
    } catch (error: any) {
      return { success: false, message: error.message || "Failed to delete user" };
    }
  })
  .post("/users", async ({ body, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || session.user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    const { name, email, password, role } = body;

    try {
      const user = await auth.api.signUpEmail({
        body: {
          email,
          password,
          name,
        },
        headers: request.headers,
      });

      if (role && role !== "user") {
        await prisma.user.update({
          where: { email },
          data: { role },
        });
      }

      return { success: true, data: user, message: "User created successfully" };
    } catch (error: any) {
      return { success: false, message: error.message || "Failed to create user" };
    }
  }, {
    body: t.Object({
      name: t.String(),
      email: t.String(),
      password: t.String(),
      role: t.Optional(t.String()),
    }),
  })
  .get("/users/:id/access", async ({ params: { id }, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || session.user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    try {
      const [queues, configs, targetUser] = await Promise.all([
        prisma.queue.findMany({
          include: { authorizedUsers: { where: { id } } }
        }),
        prisma.redisConfig.findMany({
          include: { authorizedUsers: { where: { id } } }
        }),
        prisma.user.findUnique({
          where: { id },
          include: {
            queues: { select: { id: true } },
            redisConfigs: { select: { id: true } }
          }
        })
      ]);

      if (!targetUser) throw new Error("User not found");

      const ownedQueueIds = new Set(targetUser.queues.map(q => q.id));
      const ownedConfigIds = new Set(targetUser.redisConfigs.map(c => c.id));

      return {
        success: true,
        data: {
          queues: queues.map(q => ({
            id: q.id,
            name: q.name,
            displayName: q.displayName,
            isAuthorized: q.authorizedUsers.length > 0 || ownedQueueIds.has(q.id),
            isOwner: ownedQueueIds.has(q.id)
          })),
          redisConfigs: configs.map(c => ({
            id: c.id,
            name: c.name,
            host: c.host,
            isAuthorized: c.authorizedUsers.length > 0 || ownedConfigIds.has(c.id),
            isOwner: ownedConfigIds.has(c.id)
          }))
        }
      };
    } catch (error: any) {
      console.error("Error fetching user access:", error);
      return { success: false, message: error.message || "Failed to fetch access data" };
    }
  })
  .post("/users/:id/access", async ({ params: { id }, body, request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || session.user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    const { queueIds, redisConfigIds } = body;

    try {
      // Get currently owned items to avoid removing ownership while updating authorization
      const targetUser = await prisma.user.findUnique({
        where: { id },
        include: {
          queues: { select: { id: true } },
          redisConfigs: { select: { id: true } }
        }
      });

      if (!targetUser) throw new Error("User not found");

      const ownedQueueIds = new Set(targetUser.queues.map(q => q.id));
      const ownedConfigIds = new Set(targetUser.redisConfigs.map(c => c.id));

      // Filter out owned items from the authorized list as they are implicitly authorized
      const filteredQueueIds = queueIds.filter(qid => !ownedQueueIds.has(qid));
      const filteredConfigIds = redisConfigIds.filter(cid => !ownedConfigIds.has(cid));

      await prisma.user.update({
        where: { id },
        data: {
          authorizedQueues: {
            set: filteredQueueIds.map(qid => ({ id: qid }))
          },
          authorizedRedisConfigs: {
            set: filteredConfigIds.map(cid => ({ id: cid }))
          }
        }
      });

      return { success: true, message: "Access updated successfully" };
    } catch (error: any) {
      return { success: false, message: error.message || "Failed to update access" };
    }
  }, {
    body: t.Object({
      queueIds: t.Array(t.String()),
      redisConfigIds: t.Array(t.String()),
    }),
  });

export const GET = app.fetch;
export const POST = app.fetch;
export const PATCH = app.fetch;
export const DELETE = app.fetch;
export const PUT = app.fetch;
