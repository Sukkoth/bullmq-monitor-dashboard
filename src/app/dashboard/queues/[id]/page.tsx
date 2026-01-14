"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  WarningIcon,
  TrashIcon,
  ArrowClockwiseIcon
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

interface Job {
  id: string;
  name: string;
  data: any;
  progress: number;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
  stacktrace?: string[];
  returnvalue?: any;
  attemptsMade: number;
  delay?: number;
  opts: any;
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
  const { id } = use(params);
  
  const router = useRouter();
  const [queue, setQueue] = useState<Queue | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("latest");
  const [jobCounts, setJobCounts] = useState<JobCounts>({
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
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [pollingInterval, setPollingInterval] = useState<number>(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/queue");
      const data = await res.json();
      const foundQueue = data.find((q: Queue) => q.id === id);
      if (foundQueue) {
        setQueue(foundQueue);
        // Set initial polling interval from queue config if not already set
        if (pollingInterval === 0 && foundQueue.pollingDuration > 0) {
          setPollingInterval(foundQueue.pollingDuration);
        }
      } else {
        router.push("/dashboard/queues");
      }
    } catch (error) {
      console.error("Failed to fetch queue:", error);
    } finally {
      setIsLoading(false);
    }
  }, [id, router, pollingInterval]);

  const fetchJobCounts = useCallback(async () => {
    if (!queue) return;
    
    try {
      const res = await fetch(`/api/queue/${id}/counts`);
      const result = await res.json();
      if (result.success) {
        setJobCounts(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch job counts:", error);
    }
  }, [id, queue]);

  const fetchJobs = useCallback(async (status: string, showLoading = false) => {
    if (!queue) return;
    
    if (showLoading) setIsLoadingJobs(true);
    try {
      const res = await fetch(`/api/queue/${id}/jobs/${status}?start=0&end=50`);
      const result = await res.json();
      if (result.success) {
        setJobs(result.data);
      } else {
        setJobs([]);
      }
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
      setJobs([]);
    } finally {
      if (showLoading) setIsLoadingJobs(false);
    }
  }, [id, queue]);

  const handleRetryJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/queue/${id}/jobs/${jobId}/retry`, {
        method: "POST",
      });
      const result = await res.json();
      if (result.success) {
        // Refresh jobs and counts
        fetchJobs(activeTab);
        fetchJobCounts();
      }
    } catch (error) {
      console.error("Failed to retry job:", error);
    }
  };

  const handleRemoveJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/queue/${id}/jobs/${jobId}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (result.success) {
        // Refresh jobs and counts
        fetchJobs(activeTab);
        fetchJobCounts();
      }
    } catch (error) {
      console.error("Failed to remove job:", error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchJobCounts(),
      fetchJobs(activeTab),
    ]);
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  useEffect(() => {
    if (queue) {
      fetchJobCounts();
    }
  }, [queue, fetchJobCounts]);

  useEffect(() => {
    if (queue) {
      // Only show loading on first load or tab change, not background refreshes
      fetchJobs(activeTab, true);
    }
  }, [activeTab, queue]); // Removed fetchJobs from dependency to avoid loop if it changes

  // Auto-refresh based on polling duration
  useEffect(() => {
    if (!queue || pollingInterval === 0) return;

    const interval = setInterval(() => {
      fetchJobCounts();
      fetchJobs(activeTab, false); // Don't show loading state
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [queue, activeTab, pollingInterval, fetchJobCounts]); // Removed fetchJobs

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (start?: number, end?: number) => {
    if (!start || !end) return "N/A";
    const duration = end - start;
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    return `${(duration / 60000).toFixed(1)}m`;
  };

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
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 h-7 bg-muted/50 rounded-none border border-border/50">
            <div className="flex items-center gap-1.5 mr-1">
              <div className={`h-1.5 w-1.5 rounded-full ${pollingInterval > 0 ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30"}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Auto-Sync</span>
            </div>
            <Select 
              value={pollingInterval.toString()} 
              onValueChange={(v) => setPollingInterval(Number(v))}
            >
              <SelectTrigger size="sm" className="h-5 w-[65px] text-[10px] border-none bg-transparent hover:bg-muted focus:ring-0 px-1">
                <SelectValue placeholder="Interval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Off</SelectItem>
                <SelectItem value="5000">5s</SelectItem>
                <SelectItem value="10000">10s</SelectItem>
                <SelectItem value="30000">30s</SelectItem>
                <SelectItem value="60000">1m</SelectItem>
                <SelectItem value="300000">5m</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <ArrowsClockwiseIcon className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Job Status Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {JOB_STATUSES.map((status) => {
          const Icon = status.icon;
          const count = jobCounts[status.key as keyof JobCounts];
          
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
                {isLoadingJobs ? (
                  <div className="flex items-center justify-center py-12">
                    <SpinnerIcon className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : jobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <ListBulletsIcon className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-sm">No {status.label.toLowerCase()} jobs found</p>
                    <p className="text-xs mt-1">Jobs will appear here when available</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">Job ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Created</TableHead>
                          {status.key === "active" && <TableHead>Progress</TableHead>}
                          {status.key === "completed" && <TableHead>Duration</TableHead>}
                          {status.key === "failed" && <TableHead>Reason</TableHead>}
                          {status.key === "delayed" && <TableHead>Delay</TableHead>}
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jobs.map((job) => (
                          <TableRow key={job.id}>
                            <TableCell className="font-mono text-xs">{job.id}</TableCell>
                            <TableCell className="font-medium">{job.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatTimestamp(job.timestamp)}
                            </TableCell>
                            {status.key === "active" && (
                              <TableCell>
                                <Badge variant="outline">{job.progress}%</Badge>
                              </TableCell>
                            )}
                            {status.key === "completed" && (
                              <TableCell className="text-xs">
                                {formatDuration(job.processedOn, job.finishedOn)}
                              </TableCell>
                            )}
                            {status.key === "failed" && (
                              <TableCell className="text-xs text-red-500 max-w-[200px] truncate">
                                {job.failedReason || "Unknown error"}
                              </TableCell>
                            )}
                            {status.key === "delayed" && (
                              <TableCell className="text-xs">
                                {job.delay ? `${job.delay}ms` : "N/A"}
                              </TableCell>
                            )}
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {status.key === "failed" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRetryJob(job.id)}
                                  >
                                    <ArrowClockwiseIcon className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveJob(job.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
