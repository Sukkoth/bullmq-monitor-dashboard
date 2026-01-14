"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  ClockIcon, 
  ArrowClockwiseIcon, 
  TrashIcon, 
  PlayIcon, 
  CodeIcon,
  GearIcon,
  ListBulletsIcon,
  WarningCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  CopyIcon,
  CaretDownIcon,
  CaretRightIcon
} from "@phosphor-icons/react";

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

interface JobCardProps {
  job: Job;
  queueId: string;
  status: string;
  onRetry: (jobId: string) => void;
  onRemove: (jobId: string) => void;
}

export function JobCard({ job, queueId, status, onRetry, onRemove }: JobCardProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [activeTab, setActiveTab] = useState("data");
  const [isStacktraceOpen, setIsStacktraceOpen] = useState(false);

  const fetchLogs = async () => {
    if (logs.length > 0) return;
    
    setIsLoadingLogs(true);
    try {
      const res = await fetch(`/api/queue/${queueId}/job/${job.id}/logs`);
      const result = await res.json();
      if (result.success) {
        setLogs(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "text-green-500";
      case "completed": return "text-emerald-500";
      case "failed": return "text-red-500";
      case "delayed": return "text-amber-500";
      case "waiting": return "text-yellow-500";
      case "paused": return "text-gray-500";
      default: return "text-blue-500";
    }
  };

  return (
    <Card className="overflow-hidden border-l-4 border-l-primary/20 hover:border-l-primary transition-all">
      <CardHeader className="pb-3 bg-muted/30">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">#{job.id}</Badge>
              <h3 className="font-semibold text-lg">{job.name}</h3>
              <Badge className={`capitalize ${getStatusColor(status)} bg-transparent border-current`}>
                {status}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <ClockIcon className="h-3.5 w-3.5" />
                <span>Added: {formatTime(job.timestamp)}</span>
              </div>
              {job.processedOn && (
                <div className="flex items-center gap-1">
                  <PlayIcon className="h-3.5 w-3.5" />
                  <span>Started: {formatTime(job.processedOn)}</span>
                </div>
              )}
              {job.finishedOn && (
                <div className="flex items-center gap-1">
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  <span>Finished: {formatTime(job.finishedOn)}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {status === "failed" && (
              <Button size="sm" variant="outline" onClick={() => onRetry(job.id)}>
                <ArrowClockwiseIcon className="mr-2 h-4 w-4" />
                Retry
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onRemove(job.id)}>
              <TrashIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {status === "active" && (
          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{job.progress}%</span>
            </div>
            <Progress value={job.progress} className="h-1.5" />
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={(v) => {
          setActiveTab(v);
          if (v === "logs") fetchLogs();
        }} className="w-full">
          <div className="border-b px-4 bg-muted/10">
            <TabsList className="h-10 bg-transparent p-0">
              <TabsTrigger value="data" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary px-4">
                <CodeIcon className="mr-2 h-4 w-4" />
                Data
              </TabsTrigger>
              <TabsTrigger value="options" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary px-4">
                <GearIcon className="mr-2 h-4 w-4" />
                Options
              </TabsTrigger>
              <TabsTrigger value="logs" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary px-4">
                <ListBulletsIcon className="mr-2 h-4 w-4" />
                Logs
              </TabsTrigger>
              <TabsTrigger value="error" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary px-4 disabled:opacity-50" disabled={!job.failedReason}>
                <WarningCircleIcon className="mr-2 h-4 w-4" />
                Error
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-4 bg-muted/5 min-h-[200px]">
            <TabsContent value="data" className="mt-0 space-y-2">
              <div className="flex justify-end">
                <Button variant="ghost" size="xs" onClick={() => copyToClipboard(JSON.stringify(job.data, null, 2))}>
                  <CopyIcon className="mr-1 h-3 w-3" />
                  Copy
                </Button>
              </div>
              <div className="rounded-md border bg-muted/30 overflow-auto max-h-[300px]">
                <SyntaxHighlighter 
                  language="json" 
                  style={oneLight}
                  customStyle={{ margin: 0, borderRadius: 0, fontSize: '12px' }}
                >
                  {JSON.stringify(job.data, null, 2)}
                </SyntaxHighlighter>
              </div>
            </TabsContent>

            <TabsContent value="options" className="mt-0 space-y-2">
              <div className="flex justify-end">
                <Button variant="ghost" size="xs" onClick={() => copyToClipboard(JSON.stringify(job.opts, null, 2))}>
                  <CopyIcon className="mr-1 h-3 w-3" />
                  Copy
                </Button>
              </div>
              <div className="rounded-md border bg-muted/30 overflow-auto max-h-[300px]">
                <SyntaxHighlighter 
                  language="json" 
                  style={oneLight}
                  customStyle={{ margin: 0, borderRadius: 0, fontSize: '12px' }}
                >
                  {JSON.stringify(job.opts, null, 2)}
                </SyntaxHighlighter>
              </div>
            </TabsContent>

            <TabsContent value="logs" className="mt-0">
              {isLoadingLogs ? (
                <div className="flex items-center justify-center h-[100px] text-muted-foreground">
                  <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                  Loading logs...
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[100px] text-muted-foreground text-sm">
                  <ListBulletsIcon className="h-8 w-8 mb-2 opacity-20" />
                  No logs found for this job
                </div>
              ) : (
                <div className="space-y-1 font-mono text-xs bg-muted/30 text-foreground p-4 rounded-md border h-[300px] overflow-auto">
                  {logs.map((log, i) => (
                    <div key={i} className="border-b border-border/50 pb-1 mb-1 last:border-0 last:mb-0 last:pb-0">
                      <span className="text-muted-foreground mr-3 select-none w-6 inline-block text-right">{i + 1}</span>
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="error" className="mt-0">
              {job.failedReason && (
                <div className="space-y-4">
                  <div className="bg-red-500/10 border border-red-500/20 rounded-md p-4">
                    <h4 className="text-sm font-semibold text-red-500 mb-2 flex items-center">
                      <XCircleIcon className="mr-2 h-4 w-4" />
                      Failed Reason
                    </h4>
                    <p className="text-sm text-red-600/90 font-mono break-all">{job.failedReason}</p>
                  </div>
                  
                  {job.stacktrace && job.stacktrace.length > 0 && (
                    <Collapsible
                      open={isStacktraceOpen}
                      onOpenChange={setIsStacktraceOpen}
                      className="space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-muted-foreground">Stacktrace</h4>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-9 p-0">
                            {isStacktraceOpen ? (
                              <CaretDownIcon className="h-4 w-4" />
                            ) : (
                              <CaretRightIcon className="h-4 w-4" />
                            )}
                            <span className="sr-only">Toggle Stacktrace</span>
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent className="space-y-2">
                        <div className="rounded-md border bg-muted/30 p-4 overflow-auto max-h-[300px]">
                          <pre className="text-xs font-mono text-red-500/80 leading-relaxed whitespace-pre-wrap">
                            {job.stacktrace.join('\n')}
                          </pre>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
