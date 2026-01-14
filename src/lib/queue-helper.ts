import { Queue, Job } from 'bullmq';
import { decrypt } from '@/lib/crypto';

interface RedisConfig {
    id: string;
    host: string;
    port: number;
    username?: string | null;
    password?: string | null;
    db: number;
    tls: boolean;
}

interface JobCounts {
    latest: number;
    active: number;
    waiting: number;
    waitingChildren: number;
    prioritized: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
}

// Cache for Queue instances to avoid creating multiple connections
const queueCache = new Map<string, Queue>();

/**
 * Get or create a BullMQ Queue instance
 * @param queueName - Name of the queue
 * @param redisConfig - Redis configuration from database
 * @returns Queue instance
 */
export async function getQueueInstance(queueName: string, redisConfig: RedisConfig): Promise<Queue> {
    const cacheKey = `${queueName}-${redisConfig.id}`;

    if (queueCache.has(cacheKey)) {
        return queueCache.get(cacheKey)!;
    }

    const queue = new Queue(queueName, {
        connection: {
            host: redisConfig.host,
            port: redisConfig.port,
            username: redisConfig.username || undefined,
            password: redisConfig.password ? decrypt(redisConfig.password) : undefined,
            db: redisConfig.db,
            tls: redisConfig.tls ? {} : undefined,
        },
    });

    queueCache.set(cacheKey, queue);
    return queue;
}

/**
 * Get job counts for all statuses
 * @param queue - BullMQ Queue instance
 * @returns Object with counts for each status
 */
export async function getJobCounts(queue: Queue): Promise<JobCounts> {
    try {
        const [
            activeCount,
            waitingCount,
            waitingChildrenCount,
            prioritizedCount,
            completedCount,
            failedCount,
            delayedCount,
            pausedCount,
        ] = await Promise.all([
            queue.getActiveCount(),
            queue.getWaitingCount(),
            queue.getWaitingChildrenCount(),
            queue.getPrioritizedCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount(),
            queue.count(), // Total count for paused check
        ]);

        // Check if queue is paused
        const isPaused = await queue.isPaused();

        // Latest is a combination of recent jobs from all statuses
        const latestCount = Math.min(
            activeCount + waitingCount + completedCount + failedCount,
            100 // Cap at 100 for performance
        );

        return {
            latest: latestCount,
            active: activeCount,
            waiting: waitingCount,
            waitingChildren: waitingChildrenCount,
            prioritized: prioritizedCount,
            completed: completedCount,
            failed: failedCount,
            delayed: delayedCount,
            paused: isPaused ? pausedCount : 0,
        };
    } catch (error) {
        console.error('Error fetching job counts:', error);
        throw error;
    }
}

/**
 * Get jobs by status with pagination
 * @param queue - BullMQ Queue instance
 * @param status - Job status
 * @param start - Start index (default 0)
 * @param end - End index (default 50)
 * @returns Array of jobs
 */
export async function getJobs(
    queue: Queue,
    status: string,
    start: number = 0,
    end: number = 50
): Promise<Job[]> {
    try {
        let jobs: Job[] = [];

        switch (status) {
            case 'latest':
                // Get a mix of recent jobs from different statuses
                const [active, waiting, completed, failed] = await Promise.all([
                    queue.getJobs(['active'], start, Math.min(end, start + 10)),
                    queue.getJobs(['waiting'], start, Math.min(end, start + 10)),
                    queue.getJobs(['completed'], start, Math.min(end, start + 15)),
                    queue.getJobs(['failed'], start, Math.min(end, start + 15)),
                ]);

                jobs = [...active, ...waiting, ...completed, ...failed]
                    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                    .slice(0, end - start);
                break;

            case 'active':
                jobs = await queue.getJobs(['active'], start, end);
                break;

            case 'waiting':
                jobs = await queue.getJobs(['waiting'], start, end);
                break;

            case 'waitingChildren':
                jobs = await queue.getJobs(['waiting-children'], start, end);
                break;

            case 'prioritized':
                jobs = await queue.getJobs(['prioritized'], start, end);
                break;

            case 'completed':
                jobs = await queue.getJobs(['completed'], start, end);
                break;

            case 'failed':
                jobs = await queue.getJobs(['failed'], start, end);
                break;

            case 'delayed':
                jobs = await queue.getJobs(['delayed'], start, end);
                break;

            case 'paused':
                const isPaused = await queue.isPaused();
                if (isPaused) {
                    jobs = await queue.getJobs(['waiting', 'active'], start, end);
                }
                break;

            default:
                throw new Error(`Unknown status: ${status}`);
        }

        return jobs;
    } catch (error) {
        console.error(`Error fetching jobs for status ${status}:`, error);
        throw error;
    }
}

/**
 * Get a single job by ID
 * @param queue - BullMQ Queue instance
 * @param jobId - Job ID
 * @returns Job instance or null
 */
export async function getJobById(queue: Queue, jobId: string) {
    try {
        const job = await queue.getJob(jobId);
        return job;
    } catch (error) {
        console.error(`Error fetching job ${jobId}:`, error);
        throw error;
    }
}

/**
 * Retry a failed job
 * @param queue - BullMQ Queue instance
 * @param jobId - Job ID
 * @returns Success status
 */
export async function retryJob(queue: Queue, jobId: string): Promise<boolean> {
    try {
        const job = await queue.getJob(jobId);
        if (!job) {
            throw new Error('Job not found');
        }

        await job.retry();
        return true;
    } catch (error) {
        console.error(`Error retrying job ${jobId}:`, error);
        throw error;
    }
}

/**
 * Remove a job from the queue
 * @param queue - BullMQ Queue instance
 * @param jobId - Job ID
 * @returns Success status
 */
export async function removeJob(queue: Queue, jobId: string): Promise<boolean> {
    try {
        const job = await queue.getJob(jobId);
        if (!job) {
            throw new Error('Job not found');
        }

        await job.remove();
        return true;
    } catch (error) {
        console.error(`Error removing job ${jobId}:`, error);
        throw error;
    }
}

/**
 * Clean up queue cache (call when needed)
 */
export function clearQueueCache() {
    queueCache.clear();
}
