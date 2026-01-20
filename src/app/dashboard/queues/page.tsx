"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { TrashIcon, PlusIcon, CheckCircleIcon, XCircleIcon, SpinnerIcon, PencilSimpleIcon, XIcon, ClockIcon } from "@phosphor-icons/react";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { QueueCard } from "@/components/queue/queue-card";

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

const queueSchema = z.object({
  name: z.string().min(1, "Queue name is required").max(100, "Queue name must be less than 100 characters"),
  displayName: z.string().min(1, "Display name is required").max(100, "Display name must be less than 100 characters"),
  note: z.string().max(500, "Note must be less than 500 characters").optional(),
  tags: z.array(z.string()).optional(),
  pollingDuration: z.number().min(0, "Polling duration must be positive").optional(),
  redisConfigId: z.string().min(1, "Redis configuration is required"),
});

type QueueForm = z.infer<typeof queueSchema>;

const POLLING_OPTIONS = [
  { value: "0", label: "Off" },
  { value: "5000", label: "5s" },
  { value: "10000", label: "10s" },
  { value: "30000", label: "30s" },
  { value: "60000", label: "1m" },
  { value: "300000", label: "5m" },
];

export default function QueuesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redisConfigIdFilter = searchParams.get("redisConfigId");
  
  const [queues, setQueues] = useState<Queue[]>([]);
  const [redisConfigs, setRedisConfigs] = useState<RedisConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const [editingQueue, setEditingQueue] = useState<Queue | null>(null);
  const [queueToDelete, setQueueToDelete] = useState<Queue | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [editTagInput, setEditTagInput] = useState("");

  const addForm = useForm({
    defaultValues: {
      name: "",
      displayName: "",
      note: "",
      tags: [] as string[],
      pollingDuration: 0,
      redisConfigId: "",
    } as QueueForm,
    onSubmit: async ({ value }) => {
      await handleSubmit(value, false);
    },
  });

  const editForm = useForm({
    defaultValues: {
      name: "",
      displayName: "",
      note: "",
      tags: [] as string[],
      pollingDuration: 0,
      redisConfigId: "",
    } as QueueForm,
    onSubmit: async ({ value }) => {
      await handleSubmit(value, true);
    },
  });

  useEffect(() => {
    if (editingQueue) {
      editForm.setFieldValue("name", editingQueue.name);
      editForm.setFieldValue("displayName", editingQueue.displayName);
      editForm.setFieldValue("note", editingQueue.note || "");
      editForm.setFieldValue("tags", JSON.parse(editingQueue.tags || "[]"));
      editForm.setFieldValue("pollingDuration", editingQueue.pollingDuration);
      editForm.setFieldValue("redisConfigId", editingQueue.redisConfigId);
    }
  }, [editingQueue, editForm]);

  // Reset Add Form when dialog closes
  useEffect(() => {
    if (!isAddDialogOpen) {
      addForm.reset();
      setTagInput("");
      setSaveResult(null);
    }
  }, [isAddDialogOpen, addForm]);

  // Reset Edit Form when dialog closes
  useEffect(() => {
    if (!isEditDialogOpen) {
      editForm.reset();
      setEditTagInput("");
      setEditingQueue(null);
      setSaveResult(null);
    }
  }, [isEditDialogOpen, editForm]);

  const fetchQueues = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/queue");
      const data = await res.json();
      setQueues(data);
    } catch (error) {
      console.error("Failed to fetch queues:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchRedisConfigs = useCallback(async () => {
    try {
      const res = await fetch("/api/redis/config");
      const data = await res.json();
      setRedisConfigs(data);
    } catch (error) {
      console.error("Failed to fetch redis configs:", error);
    }
  }, []);

  useEffect(() => {
    fetchQueues();
    fetchRedisConfigs();
  }, [fetchQueues, fetchRedisConfigs]);

  const handleSubmit = async (data: QueueForm, isEdit: boolean = false) => {
    setIsSaving(true);
    setSaveResult(null);

    try {
      const url = isEdit && editingQueue ? `/api/queue/${editingQueue.id}` : "/api/queue";
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
        fetchQueues();
        if (!isEdit) {
          setIsAddDialogOpen(false);
        } else {
          setIsEditDialogOpen(false);
        }
        setSaveResult({ success: true, message: `Queue ${isEdit ? "updated" : "created"} successfully` });
      } else {
        setSaveResult({ success: false, message: result.message || "Failed to save queue" });
      }
    } catch (error: any) {
      setSaveResult({ success: false, message: error.message || "An unexpected error occurred" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!queueToDelete) return;

    try {
      const res = await fetch(`/api/queue/${queueToDelete.id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) {
        fetchQueues();
        setIsDeleteDialogOpen(false);
        setQueueToDelete(null);
      }
    } catch (error) {
      console.error("Failed to delete queue:", error);
    }
  };

  const addTag = (tag: string, form: typeof addForm | typeof editForm) => {
    const trimmedTag = tag.trim();
    if (trimmedTag) {
      const currentTags = form.state.values.tags || [];
      if (!currentTags.includes(trimmedTag)) {
        form.setFieldValue("tags", [...currentTags, trimmedTag]);
      }
    }
  };

  const removeTag = (tagToRemove: string, form: typeof addForm | typeof editForm) => {
    const currentTags = form.state.values.tags || [];
    form.setFieldValue("tags", currentTags.filter(tag => tag !== tagToRemove));
  };

  const getPollingLabel = (duration: number) => {
    const option = POLLING_OPTIONS.find(opt => opt.value === duration.toString());
    return option ? option.label : "Off";
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Queue Management</h1>
        <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Add Queue
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Queues</h2>
          <div className="flex items-center gap-2">
            {redisConfigIdFilter && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-xs"
                onClick={() => router.push("/dashboard/queues")}
              >
                <XIcon className="mr-1 h-3 w-3" />
                Clear Filter
              </Button>
            )}
            <p className="text-sm text-muted-foreground">
              {queues.length} {queues.length === 1 ? "queue" : "queues"} configured
            </p>
          </div>
        </div>

        {isLoading && queues.length === 0 ? (
          <Card className="bg-muted/50">
            <CardContent className="flex h-32 items-center justify-center">
              <SpinnerIcon className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : queues.length === 0 ? (
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="flex flex-col h-64 items-center justify-center text-muted-foreground gap-4">
              <div className="rounded-full bg-muted p-4">
                <PlusIcon className="h-8 w-8" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">No queues added yet</p>
                <p className="text-sm">Add your first queue to start monitoring.</p>
              </div>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                Add Queue
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {queues
              .filter(q => !redisConfigIdFilter || q.redisConfigId === redisConfigIdFilter)
              .map((queue) => (
              <QueueCard
                key={queue.id}
                queue={queue}
                onEdit={(q) => {
                  setEditingQueue(q);
                  setIsEditDialogOpen(true);
                  setSaveResult(null);
                }}
                onDelete={(q) => {
                  setQueueToDelete(q);
                  setIsDeleteDialogOpen(true);
                }}
                getPollingLabel={getPollingLabel}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Queue Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Queue</DialogTitle>
            <DialogDescription>
              Create a new queue to monitor on your Redis instance.
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
            <addForm.Field
              name="redisConfigId"
              validators={{
                onChange: ({ value }) => {
                  const result = queueSchema.shape.redisConfigId.safeParse(value);
                  return result.success ? undefined : result.error.issues[0].message;
                },
              }}
              children={(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Redis Configuration</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v)}
                  >
                    <SelectTrigger id={field.name}>
                      <SelectValue placeholder="Select Redis config" />
                    </SelectTrigger>
                    <SelectContent>
                      {redisConfigs.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                          {config.name} ({config.host}:{config.port})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {field.state.meta.errors.length > 0 ? (
                    <em className="text-xs text-destructive">{field.state.meta.errors[0] as string}</em>
                  ) : null}
                </div>
              )}
            />

            <addForm.Field
              name="name"
              validators={{
                onChange: ({ value }) => {
                  const result = queueSchema.shape.name.safeParse(value);
                  return result.success ? undefined : result.error.issues[0].message;
                },
              }}
              children={(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Queue Name</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="email-queue"
                  />
                  <p className="text-[10px] text-muted-foreground">Internal queue identifier used by BullMQ</p>
                  {field.state.meta.errors.length > 0 ? (
                    <em className="text-xs text-destructive">{field.state.meta.errors[0] as string}</em>
                  ) : null}
                </div>
              )}
            />

            <addForm.Field
              name="displayName"
              validators={{
                onChange: ({ value }) => {
                  const result = queueSchema.shape.displayName.safeParse(value);
                  return result.success ? undefined : result.error.issues[0].message;
                },
              }}
              children={(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Display Name</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Email Queue"
                  />
                  {field.state.meta.errors.length > 0 ? (
                    <em className="text-xs text-destructive">{field.state.meta.errors[0] as string}</em>
                  ) : null}
                </div>
              )}
            />

            <addForm.Field
              name="note"
              validators={{
                onChange: ({ value }) => {
                  const result = queueSchema.shape.note.safeParse(value);
                  return result.success ? undefined : result.error.issues[0].message;
                },
              }}
              children={(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Note (Optional)</Label>
                  <Textarea
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Add a description or notes about this queue..."
                    rows={3}
                  />
                  {field.state.meta.errors.length > 0 ? (
                    <em className="text-xs text-destructive">{field.state.meta.errors[0] as string}</em>
                  ) : null}
                </div>
              )}
            />

            <addForm.Field
              name="tags"
              children={(field) => (
                <div className="grid gap-2">
                  <Label>Tags (Optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag(tagInput, addForm);
                          setTagInput("");
                        }
                      }}
                      placeholder="Add a tag and press Enter"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        addTag(tagInput, addForm);
                        setTagInput("");
                      }}
                    >
                      Add
                    </Button>
                  </div>
                  {field.state.value && field.state.value.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {field.state.value.map((tag, idx) => (
                        <Badge key={idx} variant="secondary" className="gap-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag, addForm)}
                            className="ml-1 hover:text-destructive"
                          >
                            <XIcon className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            />

            <addForm.Field
              name="pollingDuration"
              validators={{
                onChange: ({ value }) => {
                  const result = queueSchema.shape.pollingDuration.safeParse(value);
                  return result.success ? undefined : result.error.issues[0].message;
                },
              }}
              children={(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name}>Polling Duration</Label>
                  <Select
                    value={field.state.value?.toString() || "0"}
                    onValueChange={(v) => field.handleChange(Number(v))}
                  >
                    <SelectTrigger id={field.name}>
                      <SelectValue placeholder="Select polling interval" />
                    </SelectTrigger>
                    <SelectContent>
                      {POLLING_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">How often to refresh queue data</p>
                  {field.state.meta.errors.length > 0 ? (
                    <em className="text-xs text-destructive">{field.state.meta.errors[0] as string}</em>
                  ) : null}
                </div>
              )}
            />

            {saveResult && !isEditDialogOpen && (
              <div className={`flex items-center gap-2 text-sm p-3 rounded-md ${saveResult.success ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                {saveResult.success ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                {saveResult.message}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <addForm.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
                children={([canSubmit, isSubmitting]) => (
                  <Button type="submit" disabled={isSaving || !canSubmit || isSubmitting}>
                    {isSaving ? <SpinnerIcon className="mr-2 h-4 w-4 animate-spin" /> : <PlusIcon className="mr-2 h-4 w-4" />}
                    Add Queue
                  </Button>
                )}
              />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Queue Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Queue</DialogTitle>
            <DialogDescription>
              Update your queue configuration.
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
            <editForm.Field
              name="redisConfigId"
              validators={{
                onChange: ({ value }) => {
                  const result = queueSchema.shape.redisConfigId.safeParse(value);
                  return result.success ? undefined : result.error.issues[0].message;
                },
              }}
              children={(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={`edit-${field.name}`}>Redis Configuration</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v)}
                  >
                    <SelectTrigger id={`edit-${field.name}`}>
                      <SelectValue placeholder="Select Redis config" />
                    </SelectTrigger>
                    <SelectContent>
                      {redisConfigs.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                          {config.name} ({config.host}:{config.port})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {field.state.meta.errors.length > 0 ? (
                    <em className="text-xs text-destructive">{field.state.meta.errors[0] as string}</em>
                  ) : null}
                </div>
              )}
            />

            <editForm.Field
              name="name"
              validators={{
                onChange: ({ value }) => {
                  const result = queueSchema.shape.name.safeParse(value);
                  return result.success ? undefined : result.error.issues[0].message;
                },
              }}
              children={(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={`edit-${field.name}`}>Queue Name</Label>
                  <Input
                    id={`edit-${field.name}`}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">Internal queue identifier used by BullMQ</p>
                  {field.state.meta.errors.length > 0 ? (
                    <em className="text-xs text-destructive">{field.state.meta.errors[0] as string}</em>
                  ) : null}
                </div>
              )}
            />

            <editForm.Field
              name="displayName"
              validators={{
                onChange: ({ value }) => {
                  const result = queueSchema.shape.displayName.safeParse(value);
                  return result.success ? undefined : result.error.issues[0].message;
                },
              }}
              children={(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={`edit-${field.name}`}>Display Name</Label>
                  <Input
                    id={`edit-${field.name}`}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  {field.state.meta.errors.length > 0 ? (
                    <em className="text-xs text-destructive">{field.state.meta.errors[0] as string}</em>
                  ) : null}
                </div>
              )}
            />

            <editForm.Field
              name="note"
              validators={{
                onChange: ({ value }) => {
                  const result = queueSchema.shape.note.safeParse(value);
                  return result.success ? undefined : result.error.issues[0].message;
                },
              }}
              children={(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={`edit-${field.name}`}>Note (Optional)</Label>
                  <Textarea
                    id={`edit-${field.name}`}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="Add a description or notes about this queue..."
                    rows={3}
                  />
                  {field.state.meta.errors.length > 0 ? (
                    <em className="text-xs text-destructive">{field.state.meta.errors[0] as string}</em>
                  ) : null}
                </div>
              )}
            />

            <editForm.Field
              name="tags"
              children={(field) => (
                <div className="grid gap-2">
                  <Label>Tags (Optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={editTagInput}
                      onChange={(e) => setEditTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag(editTagInput, editForm);
                          setEditTagInput("");
                        }
                      }}
                      placeholder="Add a tag and press Enter"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        addTag(editTagInput, editForm);
                        setEditTagInput("");
                      }}
                    >
                      Add
                    </Button>
                  </div>
                  {field.state.value && field.state.value.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {field.state.value.map((tag, idx) => (
                        <Badge key={idx} variant="secondary" className="gap-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag, editForm)}
                            className="ml-1 hover:text-destructive"
                          >
                            <XIcon className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            />

            <editForm.Field
              name="pollingDuration"
              validators={{
                onChange: ({ value }) => {
                  const result = queueSchema.shape.pollingDuration.safeParse(value);
                  return result.success ? undefined : result.error.issues[0].message;
                },
              }}
              children={(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={`edit-${field.name}`}>Polling Duration</Label>
                  <Select
                    value={field.state.value?.toString() || "0"}
                    onValueChange={(v) => field.handleChange(Number(v))}
                  >
                    <SelectTrigger id={`edit-${field.name}`}>
                      <SelectValue placeholder="Select polling interval" />
                    </SelectTrigger>
                    <SelectContent>
                      {POLLING_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">How often to refresh queue data</p>
                  {field.state.meta.errors.length > 0 ? (
                    <em className="text-xs text-destructive">{field.state.meta.errors[0] as string}</em>
                  ) : null}
                </div>
              )}
            />

            {saveResult && isEditDialogOpen && (
              <div className={`flex items-center gap-2 text-sm p-3 rounded-md ${saveResult.success ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                {saveResult.success ? <CheckCircleIcon className="h-4 w-4" /> : <XCircleIcon className="h-4 w-4" />}
                {saveResult.message}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <editForm.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
                children={([canSubmit, isSubmitting]) => (
                  <Button type="submit" disabled={isSaving || !canSubmit || isSubmitting}>
                    {isSaving ? <SpinnerIcon className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Update Queue
                  </Button>
                )}
              />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the queue <strong>{queueToDelete?.displayName}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
