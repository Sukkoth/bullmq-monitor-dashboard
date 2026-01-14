"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeftIcon, 
  SpinnerIcon, 
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  HourglassIcon,
  PauseIcon,
  ListBulletsIcon,
  ArrowsClockwiseIcon,
  WarningIcon
} from "@phosphor-icons/react";
import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";

interface RedisConfig {
  id: string;
  name: string;
  host: string;
  port: number;
}

interface Queue {
  id: string;
  name: string;
  displayName: string;
  note: string | null;
  tags: string;
  pollingDuration: number;
  redisConfigId: string;
  redisConfig: RedisConfig;
  createdAt: string;
  updatedAt: string;
}

interface JobStatusCounts {
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

const JOB_STATUSES = [
  { key: "latest", label: "Latest", icon: ListBulletsIcon, color: "text-blue-500" },
  { key: "active", label: "Active", icon: ArrowsClockwiseIcon, color: "text-green-500" },
  { key: "waiting", label: "Waiting", icon: HourglassIcon, color: "text-yellow-500" },
  { key: "waitingChildren", label: "Waiting Children", icon: ClockIcon, color: "text-orange-500" },
  { key: "prioritized", label: "Prioritized", icon: WarningIcon, color: "text-purple-500" },
  { key: "completed", label: "Completed", icon: CheckCircleIcon, color: "text-emerald-500" },
  { key: "failed", label: "Failed", icon: XCircleIcon, color: "text-red-500" },
  { key: "delayed", label: "Delayed", icon: ClockIcon, color: "text-amber-500" },
  { key: "paused", label: "Paused", icon: PauseIcon, color: "text-gray-500" },
] as const;

export default function QueueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap the params Promise using React's use() hook
  const { id } = use(params);
  
  const router = useRouter();
  const [queue, setQueue] = useState<Queue | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("latest");
  const [jobCounts, setJobCounts] = useState<JobStatusCounts>({
    latest: 0,
    active: 0,
    waiting: 0,
    waitingChildren: 0,
    prioritized: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
    paused: 0,
  });

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/queue");
      const data = await res.json();
      console.log("Fetched queues:", data);
      console.log("Looking for queue with id:", id);
      const foundQueue = data.find((q: Queue) => q.id === id);
      console.log("Found queue:", foundQueue);
      if (foundQueue) {
        setQueue(foundQueue);
      } else {
        console.log("Queue not found, redirecting...");
        // Queue not found, redirect back
        router.push("/dashboard/queues");
      }
    } catch (error) {
      console.error("Failed to fetch queue:", error);
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Mock job counts - will be replaced with actual API calls
  useEffect(() => {
    // Simulate fetching job counts
    setJobCounts({
      latest: 42,
      active: 5,
      waiting: 12,
      waitingChildren: 3,
      prioritized: 2,
      completed: 156,
      failed: 8,
      delayed: 4,
      paused: 0,
    });
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex h-[60vh] items-center justify-center">
          <SpinnerIcon className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!queue) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex h-[60vh] items-center justify-center">
          <p className="text-muted-foreground">Queue not found</p>
        </div>
      </div>
    );
  }

  const tags = JSON.parse(queue.tags || "[]");

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/dashboard/queues")}
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{queue.displayName}</h1>
              {tags.length > 0 && (
                <div className="flex gap-1">
                  {tags.map((tag: string, idx: number) => (
                    <Badge key={idx} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="font-mono">{queue.name}</span>
              <span>•</span>
              <span>Redis: {queue.redisConfig.name}</span>
              <span>•</span>
              <span>{queue.redisConfig.host}:{queue.redisConfig.port}</span>
            </div>
            {queue.note && (
              <p className="text-sm text-muted-foreground mt-2">{queue.note}</p>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm">
          <ArrowsClockwiseIcon className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Job Status Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {JOB_STATUSES.map((status) => {
          const Icon = status.icon;
          const count = jobCounts[status.key as keyof JobStatusCounts];
          
          return (
            <Card 
              key={status.key}
              className={`cursor-pointer transition-all hover:shadow-md ${
                activeTab === status.key ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => setActiveTab(status.key)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {status.label}
                </CardTitle>
                <Icon className={`h-4 w-4 ${status.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{count}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Jobs Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:grid-cols-9">
          {JOB_STATUSES.map((status) => (
            <TabsTrigger key={status.key} value={status.key} className="text-xs">
              {status.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {JOB_STATUSES.map((status) => (
          <TabsContent key={status.key} value={status.key} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {(() => {
                    const Icon = status.icon;
                    return <Icon className={`h-5 w-5 ${status.color}`} />;
                  })()}
                  {status.label} Jobs
                </CardTitle>
                <CardDescription>
                  Showing all {status.label.toLowerCase()} jobs in this queue
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Job list will go here */}
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ListBulletsIcon className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-sm">No {status.label.toLowerCase()} jobs found</p>
                  <p className="text-xs mt-1">Jobs will appear here when available</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
