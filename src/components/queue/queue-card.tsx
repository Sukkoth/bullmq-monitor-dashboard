"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrashIcon, PencilSimpleIcon, ClockIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

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

interface QueueCardProps {
  queue: Queue;
  onEdit: (queue: Queue) => void;
  onDelete: (queue: Queue) => void;
  getPollingLabel: (duration: number) => string;
}

interface JobCounts {
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  isPaused: boolean;
}

export function QueueCard({ queue, onEdit, onDelete, getPollingLabel }: QueueCardProps) {
  const router = useRouter();
  const [stats, setStats] = useState<JobCounts | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/queue/${queue.id}/counts`);
        if (!res.ok) throw new Error("Failed to fetch stats");
        const data = await res.json();
        if (isMounted) {
          if (data.success) {
            setStats(data.data);
            setHasError(false);
          } else {
            setHasError(true);
          }
        }
      } catch (error) {
        if (isMounted) {
          setHasError(true);
        }
      } finally {
        if (isMounted) {
          setIsLoadingStats(false);
        }
      }
    };

    fetchStats();

    // Poll for stats if polling is enabled
    let intervalId: NodeJS.Timeout;
    if (queue.pollingDuration > 0) {
      intervalId = setInterval(fetchStats, queue.pollingDuration);
    }

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [queue.id, queue.pollingDuration]);

  const tags = JSON.parse(queue.tags || "[]");

  return (
    <Card 
      className="group overflow-hidden transition-all hover:shadow-md cursor-pointer flex flex-col h-full" 
      onClick={() => router.push(`/dashboard/queues/${queue.id}`)}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="grid gap-1 flex-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-bold truncate pr-2">{queue.displayName}</CardTitle>
            {stats?.isPaused && (
              <Badge variant="secondary" className="bg-yellow-500/15 text-yellow-600 border-yellow-200 text-[10px] px-1.5 py-0 h-5">
                PAUSED
              </Badge>
            )}
          </div>
          <CardDescription className="font-mono text-xs truncate">
            {queue.name}
          </CardDescription>
        </div>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(queue);
            }}
          >
            <PencilSimpleIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(queue);
            }}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 flex-1 flex flex-col">
        {queue.note && (
          <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5em]">{queue.note}</p>
        )}
        
        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-2 py-2">
          {isLoadingStats ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="flex flex-col gap-1">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-4 w-8" />
              </div>
            ))
          ) : hasError ? (
            <div className="col-span-4 flex items-center justify-center py-2 text-xs text-muted-foreground bg-muted/30 rounded-md border border-dashed">
              Connection Failed
            </div>
          ) : stats ? (
            <>
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Active</span>
                <span className={`text-sm font-bold ${stats.active > 0 ? "text-green-500" : ""}`}>{stats.active}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Waiting</span>
                <span className={`text-sm font-bold ${stats.waiting > 0 ? "text-yellow-500" : ""}`}>{stats.waiting}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Failed</span>
                <span className={`text-sm font-bold ${stats.failed > 0 ? "text-red-500" : ""}`}>{stats.failed}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Delayed</span>
                <span className={`text-sm font-bold ${stats.delayed > 0 ? "text-amber-500" : ""}`}>{stats.delayed}</span>
              </div>
            </>
          ) : null}
        </div>

        <div className="mt-auto space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-muted-foreground">Redis:</span>
            <span className="font-mono truncate" title={queue.redisConfig.name}>{queue.redisConfig.name}</span>
          </div>
          
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 3).map((tag: string, idx: number) => (
                <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                  {tag}
                </Badge>
              ))}
              {tags.length > 3 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                  +{tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t mt-2">
            <div className="flex items-center gap-1.5">
              <ClockIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Polling:</span>
            </div>
            <Badge variant={queue.pollingDuration > 0 ? "default" : "outline"} className="text-[10px] px-1.5 py-0 h-5">
              {getPollingLabel(queue.pollingDuration)}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
