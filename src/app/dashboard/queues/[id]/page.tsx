"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { JobCard } from "@/components/queue/job-card";
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
  PlusIcon,
  TrashIcon,
  PlayIcon,
  DotsThreeIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CaretDoubleLeftIcon,
  CaretDoubleRightIcon,
} from "@phosphor-icons/react";
import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  isPaused: boolean;
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
    isPaused: false,
  });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [pollingInterval, setPollingInterval] = useState<number>(5000);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isAddJobOpen, setIsAddJobOpen] = useState(false);
  const [isPauseOpen, setIsPauseOpen] = useState(false);
  const [isEmptyOpen, setIsEmptyOpen] = useState(false);
  const [isRetryAllOpen, setIsRetryAllOpen] = useState(false);
  const [isPromoteAllOpen, setIsPromoteAllOpen] = useState(false);

  // Add Job Form State
  const [newJobName, setNewJobName] = useState("");
  const [newJobData, setNewJobData] = useState("{}");
  const [newJobOpts, setNewJobOpts] = useState("{}");

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/queue");
      const data = await res.json();
      const foundQueue = data.find((q: Queue) => q.id === id);
      if (foundQueue) {
        setQueue(foundQueue);
      } else {
        router.push("/dashboard/queues");
      }
    } catch (error) {
      console.error("Failed to fetch queue:", error);
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

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

  const fetchJobs = useCallback(async (status: string, showLoading = false, page = currentPage) => {
    if (!queue) return;
    
    if (showLoading) setIsLoadingJobs(true);
    try {
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;
      
      const res = await fetch(`/api/queue/${id}/jobs/${status}?start=${start}&end=${end}`);
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
  }, [id, queue, pageSize, currentPage]);

  const handleRetryJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/queue/${id}/job/${jobId}/retry`, {
        method: "POST",
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Job retried successfully");
        // Optimistically remove from UI
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
        // Background refresh to sync counts and list
        fetchJobs(activeTab, false);
        fetchJobCounts();
      } else {
        throw new Error(result.message || "Failed to retry job");
      }
    } catch (error: any) {
      toast.error("Failed to retry job", { description: error.message });
    }
  };

  const handlePromoteJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/queue/${id}/job/${jobId}/promote`, {
        method: "POST",
      });
      const result = await res.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to promote job");
      }

      toast.success("Job promoted successfully");
      // Optimistically remove from UI
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      // Background refresh to sync counts and list
      fetchJobs(activeTab, false);
      fetchJobCounts();
    } catch (error: any) {
      toast.error("Failed to promote job", { description: error.message });
    }
  };

  const handleRemoveJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/queue/${id}/job/${jobId}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Job removed successfully");
        // Optimistically remove from UI
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
        // Background refresh to sync counts and list
        fetchJobs(activeTab, false);
        fetchJobCounts();
      } else {
        throw new Error(result.message || "Failed to remove job");
      }
    } catch (error: any) {
      toast.error("Failed to remove job", { description: error.message });
    }
  };

  const handleDuplicateJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/queue/${id}/job/${jobId}/duplicate`, {
        method: "POST",
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Job duplicated successfully", { description: `New job ID: ${result.data.id}` });
        // Background refresh to sync counts and list
        fetchJobs(activeTab, false);
        fetchJobCounts();
      } else {
        throw new Error(result.message || "Failed to duplicate job");
      }
    } catch (error: any) {
      toast.error("Failed to duplicate job", { description: error.message });
    }
  };

  const handleEditJobData = async (jobId: string, newData: any) => {
    try {
      const res = await fetch(`/api/queue/${id}/job/${jobId}/data`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: newData }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Job data updated successfully");
        // Update local state if the job is in the current list
        setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, data: newData } : j)));
      } else {
        throw new Error(result.message || "Failed to update job data");
      }
    } catch (error: any) {
      toast.error("Failed to update job data", { description: error.message });
    }
  };

  const handlePauseResumeQueue = async () => {
    if (!queue) return;
    const action = jobCounts.isPaused ? "resume" : "pause";
    try {
      const res = await fetch(`/api/queue/${id}/${action}`, { method: "POST" });
      const result = await res.json();
      if (result.success) {
        toast.success(`Queue ${action}d successfully`);
        fetchJobCounts();
        setIsPauseOpen(false);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast.error(`Failed to ${action} queue`, { description: error.message });
    }
  };

  const handleEmptyQueue = async () => {
    try {
      const res = await fetch(`/api/queue/${id}/empty`, { method: "POST" });
      const result = await res.json();
      if (result.success) {
        toast.success("Queue emptied successfully");
        fetchJobCounts();
        fetchJobs(activeTab);
        setIsEmptyOpen(false);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast.error("Failed to empty queue", { description: error.message });
    }
  };

  const handleAddJob = async () => {
    try {
      let parsedData = {};
      let parsedOpts = {};
      
      try {
        parsedData = JSON.parse(newJobData);
      } catch (e) {
        throw new Error("Invalid JSON in Data field");
      }

      try {
        parsedOpts = JSON.parse(newJobOpts);
      } catch (e) {
        throw new Error("Invalid JSON in Options field");
      }

      const res = await fetch(`/api/queue/${id}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newJobName, data: parsedData, opts: parsedOpts }),
      });
      const result = await res.json();
      
      if (result.success) {
        toast.success("Job added successfully");
        setIsAddJobOpen(false);
        setNewJobName("");
        setNewJobData("{}");
        setNewJobOpts("{}");
        fetchJobCounts();
        fetchJobs(activeTab);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast.error("Failed to add job", { description: error.message });
    }
  };

  const handleRetryAll = async () => {
    try {
      const res = await fetch(`/api/queue/${id}/retry-all`, { method: "POST" });
      const result = await res.json();
      if (result.success) {
        toast.success("All failed jobs retried");
        fetchJobCounts();
        fetchJobs(activeTab);
        setIsRetryAllOpen(false);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast.error("Failed to retry all jobs", { description: error.message });
    }
  };

  const handlePromoteAll = async () => {
    try {
      const res = await fetch(`/api/queue/${id}/promote-all`, { method: "POST" });
      const result = await res.json();
      if (result.success) {
        toast.success("All delayed jobs promoted");
        fetchJobCounts();
        fetchJobs(activeTab);
        setIsPromoteAllOpen(false);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast.error("Failed to promote all jobs", { description: error.message });
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
    if (!queue) return;

    if (isInitialLoad) {
      setIsInitialLoad(false);
      fetchJobs(activeTab, true, 1);
      return;
    }

    // If we're changing tabs, always reset page to 1
    // We'll let the currentPage useEffect handle the actual fetch if page changes
    // If page is already 1, we fetch manually
    if (currentPage === 1) {
      fetchJobs(activeTab, true, 1);
    } else {
      setCurrentPage(1);
    }
  }, [activeTab, queue]);

  useEffect(() => {
    if (!queue || isInitialLoad) return;
    
    // This handles page changes. 
    // If it was triggered by a tab change (resetting to 1), it still fetches the correct tab data.
    fetchJobs(activeTab, true, currentPage);
  }, [currentPage]);

  // Auto-refresh based on polling duration
  useEffect(() => {
    if (!queue || pollingInterval === 0) return;

    const interval = setInterval(() => {
      fetchJobCounts();
      fetchJobs(activeTab, false); // Don't show loading state
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [queue, activeTab, pollingInterval, fetchJobCounts, fetchJobs]); // Added fetchJobs

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
              {jobCounts.isPaused && (
                <Badge variant="secondary" className="bg-yellow-500/15 text-yellow-600 hover:bg-yellow-500/25 border-yellow-200">
                  PAUSED
                </Badge>
              )}
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
                <SelectValue placeholder="Off" />
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

            <div className="h-4 w-[1px] bg-border mx-1" />

            {/* Queue Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <DotsThreeIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Queue Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsAddJobOpen(true)}>
                  <PlusIcon className="mr-2 h-4 w-4" /> Add Job
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsPauseOpen(true)}>
                  {jobCounts.isPaused ? (
                    <>
                      <PlayIcon className="mr-2 h-4 w-4" /> Resume Queue
                    </>
                  ) : (
                    <>
                      <PauseIcon className="mr-2 h-4 w-4" /> Pause Queue
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsEmptyOpen(true)} className="text-destructive focus:text-destructive">
                  <TrashIcon className="mr-2 h-4 w-4" /> Empty Queue
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <ArrowsClockwiseIcon className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>



      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto w-full justify-start gap-1 bg-transparent p-0">
          {JOB_STATUSES.map((status) => {
            const count = jobCounts[status.key as keyof JobCounts];
            return (
              <TabsTrigger 
                key={status.key} 
                value={status.key} 
                className="data-[state=active]:bg-muted data-[state=active]:shadow-none border border-transparent data-[state=active]:border-border px-3 py-1.5 h-auto text-xs"
              >
                {status.label}
                <span className="ml-1.5 text-[10px] text-muted-foreground bg-muted-foreground/10 px-1.5 rounded-full font-mono">
                  {count}
                </span>
              </TabsTrigger>
            );
          })}
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
                {/* Pagination Controls */}
                {jobs.length > 0 && (
                  <div className="mb-6 flex items-center justify-between border-b pb-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Rows per page:</span>
                        <Select
                          value={pageSize.toString()}
                          onValueChange={(v) => {
                            setPageSize(Number(v));
                            setCurrentPage(1);
                          }}
                        >
                          <SelectTrigger className="h-8 w-[70px] text-xs">
                            <SelectValue placeholder={pageSize.toString()} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Page {currentPage} of {Math.max(1, Math.ceil(jobCounts[activeTab as keyof JobCounts] as number / pageSize))}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1 || isLoadingJobs}
                      >
                        <CaretDoubleLeftIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1 || isLoadingJobs}
                      >
                        <CaretLeftIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage((p) => p + 1)}
                        disabled={currentPage >= Math.ceil(jobCounts[activeTab as keyof JobCounts] as number / pageSize) || isLoadingJobs}
                      >
                        <CaretRightIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setCurrentPage(Math.ceil(jobCounts[activeTab as keyof JobCounts] as number / pageSize))}
                        disabled={currentPage >= Math.ceil(jobCounts[activeTab as keyof JobCounts] as number / pageSize) || isLoadingJobs}
                      >
                        <CaretDoubleRightIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

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
                  <div className="flex flex-col gap-4">
                    {activeTab === "failed" && jobs.length > 0 && (
                      <div className="flex justify-end">
                        <Button size="sm" variant="outline" onClick={() => setIsRetryAllOpen(true)}>
                          <ArrowsClockwiseIcon className="mr-2 h-4 w-4" /> Retry All Failed
                        </Button>
                      </div>
                    )}
                    {activeTab === "delayed" && jobs.length > 0 && (
                      <div className="flex justify-end">
                        <Button size="sm" variant="outline" onClick={() => setIsPromoteAllOpen(true)}>
                          <ClockIcon className="mr-2 h-4 w-4" /> Promote All Delayed
                        </Button>
                      </div>
                    )}
                    {jobs.map((job) => (
                      <JobCard
                        key={job.id}
                        job={job}
                        queueId={id}
                        status={status.key}
                        onRetry={handleRetryJob}
                        onRemove={handleRemoveJob}
                        onPromote={handlePromoteJob}
                        onDuplicate={handleDuplicateJob}
                        onEditData={handleEditJobData}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Add Job Modal */}
      <Dialog open={isAddJobOpen} onOpenChange={setIsAddJobOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Job</DialogTitle>
            <DialogDescription>Create a new job in this queue.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Job Name</Label>
              <Input id="name" value={newJobName} onChange={(e) => setNewJobName(e.target.value)} placeholder="e.g. send-email" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="data">Data (JSON)</Label>
              <Textarea id="data" value={newJobData} onChange={(e) => setNewJobData(e.target.value)} className="font-mono text-xs" rows={5} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="opts">Options (JSON)</Label>
              <Textarea id="opts" value={newJobOpts} onChange={(e) => setNewJobOpts(e.target.value)} className="font-mono text-xs" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddJobOpen(false)}>Cancel</Button>
            <Button onClick={handleAddJob}>Add Job</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pause/Resume Confirmation */}
      <AlertDialog open={isPauseOpen} onOpenChange={setIsPauseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{jobCounts.isPaused ? "Resume Queue" : "Pause Queue"}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {jobCounts.isPaused ? "resume" : "pause"} this queue?
              {!jobCounts.isPaused && " No new jobs will be processed until resumed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePauseResumeQueue}>
              {jobCounts.isPaused ? "Resume" : "Pause"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Empty Queue Confirmation */}
      <AlertDialog open={isEmptyOpen} onOpenChange={setIsEmptyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Empty Queue</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to empty this queue? All jobs will be permanently removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEmptyQueue} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Empty Queue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Retry All Confirmation */}
      <AlertDialog open={isRetryAllOpen} onOpenChange={setIsRetryAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry All Failed Jobs</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to retry all failed jobs? This will move them to the waiting status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRetryAll}>Retry All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Promote All Confirmation */}
      <AlertDialog open={isPromoteAllOpen} onOpenChange={setIsPromoteAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Promote All Delayed Jobs</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to promote all delayed jobs? They will be processed immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePromoteAll}>Promote All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
