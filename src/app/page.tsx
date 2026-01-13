import { api } from '@/libs/eden';

export default async function Home() {
  const response = await api.get();
  const queues = response.data;

  return (
    <div>
      <h1>Welcome to the Bull Monitor Dashboard</h1>
      {queues !== null ? (
        queues.map((queue) => (
          <div
            key={queue.id}
            className="p-2 border border-gray-300 rounded-md w-fit"
          >
            <h2>{queue.displayName}</h2>
            <p>{queue.name}</p>
          </div>
        ))
      ) : (
        <p>No queues found.</p>
      )}
    </div>
  );
}
