"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ArrowsClockwiseIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  HourglassIcon,
  ClockIcon,
  ListBulletsIcon,
  WarningIcon,
  ArrowSquareOutIcon,
  DatabaseIcon,
  QueueIcon
} from "@phosphor-icons/react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface GlobalTotals {
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

interface QueueStat {
  id: string;
  name: string;
  displayName: string;
  counts: {
    active: number;
    waiting: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
    isPaused: boolean;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<{
    totals: GlobalTotals;
    queueCount: number;
    redisCount: number;
    topFailedQueues: QueueStat[];
    allQueues: QueueStat[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const res = await fetch("/api/stats/dashboard");
      const result = await res.json();
      if (result.success) {
        setStats(result.data);
      } else {
        console.error("API returned error:", result);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    fetchStats(true);
  }, [fetchStats]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchStats(false);
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-4 w-4 bg-muted rounded-full" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted rounded mt-1" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  // Empty state - no Redis connections or queues
  if (stats.redisCount === 0 || stats.queueCount === 0) {
    return (
      <div className="flex flex-1 flex-col gap-8 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome to BullMQ Monitor</h1>
            <p className="text-muted-foreground">Let's get you started with monitoring your queues</p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-12 gap-8">
          <div className="rounded-full bg-primary/10 p-6">
            <QueueIcon className="h-16 w-16 text-primary" />
          </div>

          <div className="text-center max-w-2xl space-y-2">
            <h2 className="text-2xl font-bold">Get Started in 2 Simple Steps</h2>
            <p className="text-muted-foreground">
              Connect to your Redis instance and add your BullMQ queues to start monitoring job processing in real-time.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 w-full max-w-4xl">
            {/* Step 1: Add Redis Connection */}
            <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-all">
              <div className="absolute top-4 right-4">
                <Badge className="bg-primary/10 text-primary border-primary/20 font-bold">STEP 1</Badge>
              </div>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <DatabaseIcon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Add Redis Connection</CardTitle>
                </div>
                <CardDescription className="text-sm">
                  Connect to your Redis instance where BullMQ stores queue data. You can add multiple Redis connections if you have queues across different instances.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="flex items-start gap-2">
                    <span className="text-primary font-bold">→</span>
                    <span>Provide connection details (host, port, credentials)</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-primary font-bold">→</span>
                    <span>Test the connection to ensure it works</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-primary font-bold">→</span>
                    <span>Save and monitor connection status</span>
                  </p>
                </div>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => router.push("/dashboard/redis")}
                >
                  <DatabaseIcon className="mr-2 h-4 w-4" />
                  {stats.redisCount === 0 ? "Add Your First Connection" : "Manage Connections"}
                </Button>
                {stats.redisCount > 0 && (
                  <p className="text-xs text-center text-emerald-600 font-medium">
                    ✓ {stats.redisCount} connection{stats.redisCount !== 1 ? 's' : ''} configured
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Add Queue */}
            <Card className={`relative overflow-hidden border-2 transition-all ${stats.redisCount === 0 ? 'opacity-50' : 'hover:border-primary/50'}`}>
              <div className="absolute top-4 right-4">
                <Badge className="bg-primary/10 text-primary border-primary/20 font-bold">STEP 2</Badge>
              </div>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <QueueIcon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Add Queue</CardTitle>
                </div>
                <CardDescription className="text-sm">
                  Register your BullMQ queues to monitor job processing, track failures, and manage job lifecycles across your application.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="flex items-start gap-2">
                    <span className="text-primary font-bold">→</span>
                    <span>Select a Redis connection</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-primary font-bold">→</span>
                    <span>Enter your queue name (as defined in your code)</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-primary font-bold">→</span>
                    <span>Start monitoring jobs in real-time</span>
                  </p>
                </div>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => router.push("/dashboard/queues")}
                  disabled={stats.redisCount === 0}
                >
                  <QueueIcon className="mr-2 h-4 w-4" />
                  {stats.queueCount === 0 ? "Add Your First Queue" : "Manage Queues"}
                </Button>
                {stats.redisCount === 0 && (
                  <p className="text-xs text-center text-muted-foreground">
                    Add a Redis connection first
                  </p>
                )}
                {stats.queueCount > 0 && (
                  <p className="text-xs text-center text-emerald-600 font-medium">
                    ✓ {stats.queueCount} queue{stats.queueCount !== 1 ? 's' : ''} configured
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-dashed max-w-2xl">
            <p className="text-sm text-center text-muted-foreground">
              <strong className="text-foreground">Need help?</strong> Check out the{" "}
              <a href="https://docs.bullmq.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                BullMQ documentation
              </a>{" "}
              to learn more about setting up queues in your application.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: "Active Jobs", value: stats.totals.active, icon: ArrowsClockwiseIcon, color: "text-green-500", bgColor: "bg-green-500/10" },
    { label: "Waiting Jobs", value: stats.totals.waiting, icon: HourglassIcon, color: "text-yellow-500", bgColor: "bg-yellow-500/10" },
    { label: "Failed Jobs", value: stats.totals.failed, icon: XCircleIcon, color: "text-red-500", bgColor: "bg-red-500/10" },
    { label: "Completed Jobs", value: stats.totals.completed, icon: CheckCircleIcon, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  ];

  return (
    <div className="flex flex-1 flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Dashboard</h1>
          <p className="text-muted-foreground">Global overview of your BullMQ infrastructure.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border">
              <DatabaseIcon className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{stats.redisCount} Connections</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border">
              <QueueIcon className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{stats.queueCount} Queues</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <ArrowsClockwiseIcon className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, idx) => (
          <Card key={idx}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                {card.label}
              </CardTitle>
              <div className={`p-2 rounded-full ${card.bgColor}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Top Failed Queues */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WarningIcon className="h-5 w-5 text-red-500" />
              Queue Health
            </CardTitle>
            <CardDescription>Queues requiring attention due to high failure rates.</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.topFailedQueues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CheckCircleIcon className="h-12 w-12 mb-4 text-emerald-500 opacity-20" />
                <p className="text-sm font-medium text-emerald-600">All systems operational</p>
                <p className="text-xs mt-1">No queues currently have failed jobs</p>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.topFailedQueues.map((q) => (
                  <div key={q.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/5 hover:bg-muted/10 transition-colors">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">{q.displayName}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="h-5 px-1.5 text-[10px] font-bold">
                          {q.counts.failed} FAILED
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">{q.name}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/queues/${q.id}`)}>
                      <ArrowSquareOutIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Global Overview Table */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListBulletsIcon className="h-5 w-5 text-primary" />
              Global Overview
            </CardTitle>
            <CardDescription>Real-time status of all monitored queues.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Queue</th>
                    <th className="px-4 py-3 font-semibold text-center">Active</th>
                    <th className="px-4 py-3 font-semibold text-center">Waiting</th>
                    <th className="px-4 py-3 font-semibold text-center">Failed</th>
                    <th className="px-4 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stats.allQueues.map((q) => (
                    <tr key={q.id} className="hover:bg-muted/5 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium group-hover:text-primary transition-colors">{q.displayName}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{q.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-mono ${q.counts.active > 0 ? "text-green-500 font-bold" : "text-muted-foreground/50"}`}>
                          {q.counts.active}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono">
                        {q.counts.waiting}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-mono ${q.counts.failed > 0 ? "text-red-500 font-bold" : "text-muted-foreground/50"}`}>
                          {q.counts.failed}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => router.push(`/dashboard/queues/${q.id}`)}
                        >
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

