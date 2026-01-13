import { Elysia } from 'elysia';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const app = new Elysia({ prefix: '/api' })
  .get('/', () => {
    return [
      {
        id: randomUUID(),
        name: 'Queue1',
        displayName: 'Queue 1',
      },
      {
        id: randomUUID(),
        name: 'Queue2',
        displayName: 'Queue 2',
      },
      {
        id: randomUUID(),
        name: 'Queue3',
        displayName: 'Queue 3',
      },
    ];
  })
  .post('/queue', ({ body }) => body, {
    body: z.object({
      name: z.string().min(2).max(100),
      displayName: z.string().min(2).max(100),
    }),
  });

export const GET = app.fetch;
export const POST = app.fetch;
