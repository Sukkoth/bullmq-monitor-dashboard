"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrashIcon, PlusIcon, CheckCircleIcon, XCircleIcon, SpinnerIcon, PencilSimpleIcon, ArrowCounterClockwiseIcon, PlayIcon, PauseIcon, ClockIcon, QueueIcon } from "@phosphor-icons/react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RedisConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username?: string | null;
  password?: string | null;
  db: number;
  tls: boolean;
  status?: "online" | "offline" | "checking";
}

const redisConfigSchema = z.object({
  name: z.string().min(1, "Name is required"),
  host: z.string().min(1, "Host is required"),
  port: z.number().int().min(1).max(65535),
  username: z.string().optional(),
  password: z.string().optional(),
  db: z.number().int().min(0).max(15),
  tls: z.boolean().default(false),
});

type RedisConfigForm = z.infer<typeof redisConfigSchema>;

export default function RedisPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<RedisConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [editingConfig, setEditingConfig] = useState<RedisConfig | null>(null);
  const [configToDelete, setConfigToDelete] = useState<RedisConfig | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(false);
  const [syncInterval, setSyncInterval] = useState(10000); // Default 10s
  const [addConnectionString, setAddConnectionString] = useState("");
  const [editConnectionString, setEditConnectionString] = useState("");

  const addForm = useForm({
    defaultValues: {
      name: "",
      host: "",
      port: 6379,
      username: "",
      password: "",
      db: 0,
      tls: false,
    } as RedisConfigForm,
    onSubmit: async ({ value }) => {
      await handleSubmit(value, false);
    },
  });

  const editForm = useForm({
    defaultValues: {
      name: "",
      host: "",
      port: 6379,
      username: "",
      password: "",
      db: 0,
      tls: false,
    } as RedisConfigForm,
    onSubmit: async ({ value }) => {
      await handleSubmit(value, true);
    },
  });

  useEffect(() => {
    if (editingConfig) {
      editForm.setFieldValue("name", editingConfig.name);
      editForm.setFieldValue("host", editingConfig.host);
      editForm.setFieldValue("port", editingConfig.port);
      editForm.setFieldValue("username", editingConfig.username || "");
      editForm.setFieldValue("password", editingConfig.password || "");
      editForm.setFieldValue("db", editingConfig.db);
      editForm.setFieldValue("tls", editingConfig.tls);
    }
  }, [editingConfig, editForm]);

  // Reset Add Form when dialog closes
  useEffect(() => {
    if (!isAddDialogOpen) {
      addForm.reset();
      setAddConnectionString("");
      setTestResult(null);
    }
  }, [isAddDialogOpen, addForm]);

  // Reset Edit Form when dialog closes
  useEffect(() => {
    if (!isEditDialogOpen) {
      editForm.reset();
      setEditConnectionString("");
      setEditingConfig(null);
      setTestResult(null);
    }
  }, [isEditDialogOpen, editForm]);

  const parseRedisUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
        return null;
      }

      return {
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 6379,
        username: parsed.username || "",
        password: parsed.password || "",
        db: parsed.pathname ? Number(parsed.pathname.split("/")[1]) || 0 : 0,
        tls: parsed.protocol === "rediss:",
      };
    } catch (e) {
      return null;
    }
  };

  const constructRedisUrl = (values: RedisConfigForm) => {
    const protocol = values.tls ? "rediss:" : "redis:";
    const auth = values.username || values.password 
      ? `${values.username || "default"}:${values.password}@` 
      : "";
    return `${protocol}//${auth}${values.host}:${values.port}/${values.db}`;
  };

  const fetchConfigs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/redis/config");
      const data = await res.json();
      setConfigs(data.map((c: any) => ({ ...c, status: "checking" })));
      
      // Check status for each config
      data.forEach((config: any) => {
        checkStatus(config.id);
      });
    } catch (error) {
      console.error("Failed to fetch configs:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkStatus = async (id: string) => {
    try {
      const res = await fetch(`/api/redis/status/${id}`);
      const result = await res.json();
      setConfigs(prev => prev.map(c => 
        c.id === id ? { ...c, status: result.status } : c
      ));
    } catch (error) {
      setConfigs(prev => prev.map(c => 
        c.id === id ? { ...c, status: "offline" } : c
      ));
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  useEffect(() => {
    if (!isAutoSyncEnabled) return;

    const interval = setInterval(() => {
      // Only fetch if not already loading/saving/testing
      if (!isLoading && !isSaving && !isTesting) {
        fetchConfigs();
      }
    }, syncInterval);

    return () => clearInterval(interval);
  }, [isAutoSyncEnabled, syncInterval, fetchConfigs, isLoading, isSaving, isTesting]);

  const handleTestConnection = async (data: RedisConfigForm) => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/redis/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const result = await res.json();
        setTestResult(result);
      } else {
        const text = await res.text();
        setTestResult({ success: false, message: text || "Server returned an invalid response" });
      }
    } catch (error: any) {
      setTestResult({ success: false, message: error.message || "Failed to test connection" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (data: RedisConfigForm, isEdit: boolean = false) => {
    setIsSaving(true);
    setTestResult(null);

    try {
      const url = isEdit && editingConfig ? `/api/redis/config/${editingConfig.id}` : "/api/redis/config";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const contentType = res.headers.get("content-type");
      let result;
      
      if (contentType && contentType.includes("application/json")) {
        result = await res.json();
      } else {
        const text = await res.text();
        result = { success: false, message: text || "Server returned an invalid response" };
      }
      
      if (result.success) {
        fetchConfigs();
        if (!isEdit) {
          setIsAddDialogOpen(false);
        } else {
          setIsEditDialogOpen(false);
        }
        setTestResult({ success: true, message: `Configuration ${isEdit ? "updated" : "saved"} successfully` });
      } else {
        setTestResult({ success: false, message: result.message || "Failed to save configuration" });
      }
    } catch (error: any) {
      setTestResult({ success: false, message: error.message || "An unexpected error occurred" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!configToDelete) return;
    
    try {
      const res = await fetch(`/api/redis/config/${configToDelete.id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        fetchConfigs();
        setIsDeleteDialogOpen(false);
        setConfigToDelete(null);
      }
    } catch (error) {
      console.error("Failed to delete config:", error);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Redis Configurations</h1>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 px-3 h-7 bg-muted/50 rounded-none border border-border/50">
            <div className="flex items-center gap-1.5 mr-1">
              <div className={`h-1.5 w-1.5 rounded-full ${isAutoSyncEnabled ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30"}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Auto-Sync</span>
            </div>
            <Select 
              value={isAutoSyncEnabled ? syncInterval.toString() : "off"} 
              onValueChange={(v) => {
                if (v === "off") {
                  setIsAutoSyncEnabled(false);
                } else {
                  setSyncInterval(Number(v));
                  setIsAutoSyncEnabled(true);
                }
              }}
            >
              <SelectTrigger size="sm" className="h-5 w-[65px] text-[10px] border-none bg-transparent hover:bg-muted focus:ring-0 px-1">
                <SelectValue placeholder="Interval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off</SelectItem>
                <SelectItem value="5000">5s</SelectItem>
                <SelectItem value="10000">10s</SelectItem>
                <SelectItem value="30000">30s</SelectItem>
                <SelectItem value="60000">1m</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={fetchConfigs}>
            <ArrowCounterClockwiseIcon className="mr-2 h-4 w-4" />
            Refresh Status
          </Button>
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Add Connection
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Saved Connections</h2>
          <p className="text-sm text-muted-foreground">
            {configs.length} {configs.length === 1 ? "connection" : "connections"} configured
          </p>
        </div>
        
        {isLoading && configs.length === 0 ? (
          <Card className="bg-muted/50">
            <CardContent className="flex h-32 items-center justify-center">
              <SpinnerIcon className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : configs.length === 0 ? (
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="flex flex-col h-64 items-center justify-center text-muted-foreground gap-4">
              <div className="rounded-full bg-muted p-4">
                <PlusIcon className="h-8 w-8" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">No connections added yet</p>
                <p className="text-sm">Add your first Redis connection to start monitoring queues.</p>
              </div>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                Add Connection
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {configs.map((config) => (
              <Card 
                key={config.id} 
                className="group overflow-hidden transition-all hover:shadow-md cursor-pointer"
                onClick={() => {
                  setEditingConfig(config);
                  setIsEditDialogOpen(true);
                  setTestResult(null);
                }}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="grid gap-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg font-bold">{config.name}</CardTitle>
                      <div className={`h-2.5 w-2.5 rounded-full ring-2 ring-background ${
                        config.status === "online" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : 
                        config.status === "offline" ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : 
                        "bg-yellow-500 animate-pulse"
                      }`} />
                    </div>
                    <CardDescription className="font-mono text-xs">
                      {config.host}:{config.port}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      title="View Queues"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dashboard/queues?redisConfigId=${config.id}`);
                      }}
                    >
                      <QueueIcon className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      title="Edit Connection"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingConfig(config);
                        setIsEditDialogOpen(true);
                        setTestResult(null);
                      }}
                    >
                      <PencilSimpleIcon className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      title="Delete Connection"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfigToDelete(config);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      DB {config.db}
                    </div>
                    <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      config.status === "online" ? "bg-green-500/10 text-green-500" : 
                      config.status === "offline" ? "bg-red-500/10 text-red-500" : 
                      "bg-yellow-500/10 text-yellow-500"
                    }`}>
                      {config.status?.toUpperCase() || "CHECKING"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Connection Dialog */}
      <Dialog 
        open={isAddDialogOpen} 
        onOpenChange={setIsAddDialogOpen}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Connection</DialogTitle>
            <DialogDescription>
              Connect to a new Redis instance to monitor its queues.
            </DialogDescription>
          </DialogHeader>
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addForm.handleSubmit();
            }} 
            className="grid gap-4 py-4"
          >
            <div className="grid gap-2">
              <Label htmlFor="add-connection-string">Connection String (Optional)</Label>
              <Input 
                id="add-connection-string"
                value={addConnectionString}
                onChange={(e) => {
                  const val = e.target.value;
                  setAddConnectionString(val);
                  const parsed = parseRedisUrl(val);
                  if (parsed) {
                    addForm.setFieldValue("host", parsed.host);
                    addForm.setFieldValue("port", parsed.port);
                    addForm.setFieldValue("username", parsed.username);
                    addForm.setFieldValue("password", parsed.password);
                    addForm.setFieldValue("db", parsed.db);
                    addForm.setFieldValue("tls", parsed.tls);
                  }
                }}
                placeholder="redis://default:password@localhost:6379/0"
              />
              <p className="text-[10px] text-muted-foreground">Paste a Redis URL to auto-populate fields below.</p>
            </div>

            <div className="h-px bg-border/50 my-2" />

            <addForm.Field
              name="name"
              validators={{
                onChange: ({ value }) => {
                  const result = redisConfigSchema.shape.name.safeParse(value);
                  return result.success ? undefined : result.error.issues[0].message;
                },
              }}
              children={(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Connection Name</Label>
                  <Input 
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Production Redis"
                  />
                  {field.state.meta.errors.length > 0 ? (
                    <em className="text-xs text-destructive">{field.state.meta.errors[0] as string}</em>
                  ) : null}
                </div>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <addForm.Field
                name="host"
                validators={{
                  onChange: ({ value }) => {
                    const result = redisConfigSchema.shape.host.safeParse(value);
                    return result.success ? undefined : result.error.issues[0].message;
                  },
                }}
                children={(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>Host</Label>
                    <Input 
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="localhost" 
                    />
                    {field.state.meta.errors.length > 0 ? (
                      <em className="text-xs text-destructive">{field.state.meta.errors[0] as string}</em>
                    ) : null}
                  </div>
                )}
              />
              <addForm.Field
                name="port"
                validators={{
                  onChange: ({ value }) => {
                    const result = redisConfigSchema.shape.port.safeParse(value);
                    return result.success ? undefined : result.error.issues[0].message;
                  },
                }}
                children={(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>Port</Label>
                    <Input 
                      id={field.name}
                      name={field.name}
                      type="number"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(Number(e.target.value))}
                    />
                    {field.state.meta.errors.length > 0 ? (
                      <em className="text-xs text-destructive">{field.state.meta.errors[0] as string}</em>
                    ) : null}
                  </div>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <addForm.Field
                name="username"
                validators={{
                  onChange: ({ value }) => {
                    const result = redisConfigSchema.shape.username.safeParse(value);
                    return result.success ? undefined : result.error.issues[0].message;
                  },
                }}
                children={(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>Username (Optional)</Label>
                    <Input 
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="default"
                    />
                    {field.state.meta.errors.length > 0 ? (
                      <em className="text-xs text-destructive">{field.state.meta.errors[0] as string}</em>
                    ) : null}
                  </div>
                )}
              />
              <addForm.Field
                name="password"
                validators={{
                  onChange: ({ value }) => {
                    const result = redisConfigSchema.shape.password.safeParse(value);
                    return result.success ? undefined : result.error.issues[0].message;
                  },
                }}
                children={(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>Password (Optional)</Label>
                    <Input 
                      id={field.name}
                      name={field.name}
                      type="password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </div>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <addForm.Field
                name="db"
                validators={{
                  onChange: ({ value }) => {
                    const result = redisConfigSchema.shape.db.safeParse(value);
                    return result.success ? undefined : result.error.issues[0].message;
                  },
                }}
                children={(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>Database Index</Label>
                    <Input 
                      id={field.name}
                      name={field.name}
                      type="number"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(Number(e.target.value))}
                    />
                    {field.state.meta.errors.length > 0 ? (
                      <em className="text-xs text-destructive">{field.state.meta.errors[0] as string}</em>
                    ) : null}
                  </div>
                )}
              />
              <addForm.Field
                name="tls"
                children={(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name}>TLS (SSL)</Label>
                    <Select 
                      value={field.state.value ? "true" : "false"} 
                      onValueChange={(v) => field.handleChange(v === "true")}
                    >
                      <SelectTrigger id={field.name}>
                        <SelectValue placeholder="TLS" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">Disabled</SelectItem>
                        <SelectItem value="true">Enabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
            </div>

            <addForm.Subscribe
              selector={(state) => state.values}
              children={(values) => (
                <div className="mt-2 p-2 bg-muted/30 rounded border border-border/50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Constructed URL</p>
                  <code className="text-[10px] break-all text-muted-foreground">
                    {constructRedisUrl(values)}
                  </code>
                </div>
              )}
            />

            {testResult && !isEditDialogOpen && (
              <div className={`flex items-center gap-2 text-sm p-3 rounded-md ${testResult.success ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                {testResult.success ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                {testResult.message}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <addForm.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
                children={([canSubmit, isSubmitting]) => (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={async () => {
                      await addForm.validate("submit");
                      const result = redisConfigSchema.safeParse(addForm.state.values);
                      if (result.success) {
                        handleTestConnection(addForm.state.values);
                      }
                    }}
                    disabled={isTesting || isSaving || isSubmitting}
                  >
                    {isTesting ? <SpinnerIcon className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Test
                  </Button>
                )}
              />
              <addForm.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
                children={([canSubmit, isSubmitting]) => (
                  <Button type="submit" disabled={isTesting || isSaving || !canSubmit || isSubmitting}>
                    {isSaving ? <SpinnerIcon className="mr-2 h-4 w-4 animate-spin" /> : <PlusIcon className="mr-2 h-4 w-4" />}
                    Add Connection
                  </Button>
                )}
              />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog 
        open={isEditDialogOpen} 
        onOpenChange={setIsEditDialogOpen}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Connection</DialogTitle>
            <DialogDescription>
              Update your Redis connection details.
            </DialogDescription>
          </DialogHeader>
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              editForm.handleSubmit();
            }} 
            className="grid gap-4 py-4"
          >
            <div className="grid gap-2">
              <Label htmlFor="edit-connection-string">Connection String (Optional)</Label>
              <Input 
                id="edit-connection-string"
                value={editConnectionString}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditConnectionString(val);
                  const parsed = parseRedisUrl(val);
                  if (parsed) {
                    editForm.setFieldValue("host", parsed.host);
                    editForm.setFieldValue("port", parsed.port);
                    editForm.setFieldValue("username", parsed.username);
                    editForm.setFieldValue("password", parsed.password);
                    editForm.setFieldValue("db", parsed.db);
                    editForm.setFieldValue("tls", parsed.tls);
                  }
                }}
                placeholder="redis://default:password@localhost:6379/0"
              />
              <p className="text-[10px] text-muted-foreground">Paste a Redis URL to auto-populate fields below.</p>
            </div>

            <div className="h-px bg-border/50 my-2" />

            <editForm.Field
              name="name"
              validators={{
                onChange: ({ value }) => {
                  const result = redisConfigSchema.shape.name.safeParse(value);
                  return result.success ? undefined : result.error.issues[0].message;
                },
              }}
              children={(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={`edit-${field.name}`}>Connection Name</Label>
                  <Input 
                    id={`edit-${field.name}`}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    required 
                  />
                  {field.state.meta.errors.length > 0 ? (
                    <em className="text-xs text-destructive">{field.state.meta.errors[0] as string}</em>
                  ) : null}
                </div>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <editForm.Field
                name="host"
                validators={{
                  onChange: ({ value }) => {
                    const result = redisConfigSchema.shape.host.safeParse(value);
                    return result.success ? undefined : result.error.issues[0].message;
                  },
                }}
                children={(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={`edit-${field.name}`}>Host</Label>
                    <Input 
                      id={`edit-${field.name}`}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      required 
                    />
                    {field.state.meta.errors.length > 0 ? (
                      <em className="text-xs text-destructive">{field.state.meta.errors[0] as string}</em>
                    ) : null}
                  </div>
                )}
              />
              <editForm.Field
                name="port"
                validators={{
                  onChange: ({ value }) => {
                    const result = redisConfigSchema.shape.port.safeParse(value);
                    return result.success ? undefined : result.error.issues[0].message;
                  },
                }}
                children={(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={`edit-${field.name}`}>Port</Label>
                    <Input 
                      id={`edit-${field.name}`}
                      name={field.name}
                      type="number"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(Number(e.target.value))}
                      required 
                    />
                    {field.state.meta.errors.length > 0 ? (
                      <em className="text-xs text-destructive">{field.state.meta.errors[0] as string}</em>
                    ) : null}
                  </div>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <editForm.Field
                name="username"
                validators={{
                  onChange: ({ value }) => {
                    const result = redisConfigSchema.shape.username.safeParse(value);
                    return result.success ? undefined : result.error.issues[0].message;
                  },
                }}
                children={(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={`edit-${field.name}`}>Username (Optional)</Label>
                    <Input 
                      id={`edit-${field.name}`}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="default"
                    />
                    {field.state.meta.errors.length > 0 ? (
                      <em className="text-xs text-destructive">{field.state.meta.errors[0] as string}</em>
                    ) : null}
                  </div>
                )}
              />
              <editForm.Field
                name="password"
                validators={{
                  onChange: ({ value }) => {
                    const result = redisConfigSchema.shape.password.safeParse(value);
                    return result.success ? undefined : result.error.issues[0].message;
                  },
                }}
                children={(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={`edit-${field.name}`}>Password (Optional)</Label>
                    <Input 
                      id={`edit-${field.name}`}
                      name={field.name}
                      type="password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <editForm.Field
                name="db"
                validators={{
                  onChange: ({ value }) => {
                    const result = redisConfigSchema.shape.db.safeParse(value);
                    return result.success ? undefined : result.error.issues[0].message;
                  },
                }}
                children={(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={`edit-${field.name}`}>Database Index</Label>
                    <Input 
                      id={`edit-${field.name}`}
                      name={field.name}
                      type="number"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(Number(e.target.value))}
                      required 
                    />
                    {field.state.meta.errors.length > 0 ? (
                      <em className="text-xs text-destructive">{field.state.meta.errors[0] as string}</em>
                    ) : null}
                  </div>
                )}
              />
              <editForm.Field
                name="tls"
                children={(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={`edit-${field.name}`}>TLS (SSL)</Label>
                    <Select 
                      value={field.state.value ? "true" : "false"} 
                      onValueChange={(v) => field.handleChange(v === "true")}
                    >
                      <SelectTrigger id={`edit-${field.name}`}>
                        <SelectValue placeholder="TLS" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">Disabled</SelectItem>
                        <SelectItem value="true">Enabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
            </div>

            <editForm.Subscribe
              selector={(state) => state.values}
              children={(values) => (
                <div className="mt-2 p-2 bg-muted/30 rounded border border-border/50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Constructed URL</p>
                  <code className="text-[10px] break-all text-muted-foreground">
                    {constructRedisUrl(values)}
                  </code>
                </div>
              )}
            />

            {testResult && isEditDialogOpen && (
              <div className={`flex items-center gap-2 text-sm p-3 rounded-md ${testResult.success ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                {testResult.success ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                {testResult.message}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <editForm.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
                children={([canSubmit, isSubmitting]) => (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={async () => {
                      await editForm.validate("submit");
                      const result = redisConfigSchema.safeParse(editForm.state.values);
                      if (result.success) {
                        handleTestConnection(editForm.state.values);
                      }
                    }}
                    disabled={isTesting || isSaving || isSubmitting}
                  >
                    {isTesting ? <SpinnerIcon className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Test
                  </Button>
                )}
              />
              <editForm.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
                children={([canSubmit, isSubmitting]) => (
                  <Button type="submit" disabled={isTesting || isSaving || !canSubmit || isSubmitting}>
                    {isSaving ? <SpinnerIcon className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircleIcon className="mr-2 h-4 w-4" />}
                    Save Changes
                  </Button>
                )}
              />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the connection to <strong>{configToDelete?.name}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfigToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
