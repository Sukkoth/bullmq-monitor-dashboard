"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash, Plus, CheckCircle, XCircle, Spinner, PencilSimple, ArrowCounterClockwise } from "@phosphor-icons/react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  password?: string | null;
  db: number;
  status?: "online" | "offline" | "checking";
}

export default function RedisPage() {
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
  const router = useRouter();

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

  const handleTestConnection = async (formData: FormData) => {
    const data = {
      host: formData.get("host") as string,
      port: parseInt(formData.get("port") as string),
      password: formData.get("password") as string,
      db: parseInt(formData.get("db") as string),
    };

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/redis/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      setTestResult(result);
    } catch (error: any) {
      setTestResult({ success: false, message: error.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>, isEdit: boolean = false) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      host: formData.get("host") as string,
      port: parseInt(formData.get("port") as string),
      password: formData.get("password") as string,
      db: parseInt(formData.get("db") as string),
    };

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
      const result = await res.json();
      
      if (result.success) {
        fetchConfigs();
        if (!isEdit) {
          (e.target as HTMLFormElement).reset();
          setIsAddDialogOpen(false);
        } else {
          setIsEditDialogOpen(false);
          setEditingConfig(null);
        }
        setTestResult({ success: true, message: `Configuration ${isEdit ? "updated" : "saved"} successfully` });
      } else {
        setTestResult({ success: false, message: result.message || "Failed to save configuration" });
      }
    } catch (error: any) {
      setTestResult({ success: false, message: error.message });
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
          <Button variant="outline" size="sm" onClick={fetchConfigs}>
            <ArrowCounterClockwise className="mr-2 h-4 w-4" />
            Refresh Status
          </Button>
          <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
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
              <Spinner className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : configs.length === 0 ? (
          <Card className="bg-muted/50 border-dashed">
            <CardContent className="flex flex-col h-64 items-center justify-center text-muted-foreground gap-4">
              <div className="rounded-full bg-muted p-4">
                <Plus className="h-8 w-8" />
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
              <Card key={config.id} className="group overflow-hidden transition-all hover:shadow-md">
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
                      onClick={() => {
                        setEditingConfig(config);
                        setIsEditDialogOpen(true);
                        setTestResult(null);
                      }}
                    >
                      <PencilSimple className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setConfigToDelete(config);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash className="h-4 w-4" />
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
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Connection</DialogTitle>
            <DialogDescription>
              Connect to a new Redis instance to monitor its queues.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => handleSubmit(e, false)} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Connection Name</Label>
              <Input 
                id="name" 
                name="name" 
                placeholder="Production Redis" 
                required 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="host">Host</Label>
                <Input 
                  id="host" 
                  name="host" 
                  placeholder="localhost" 
                  required 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="port">Port</Label>
                <Input 
                  id="port" 
                  name="port" 
                  type="number" 
                  defaultValue={6379} 
                  required 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="password">Password (Optional)</Label>
                <Input 
                  id="password" 
                  name="password" 
                  type="password" 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="db">Database Index</Label>
                <Input 
                  id="db" 
                  name="db" 
                  type="number" 
                  defaultValue={0} 
                  required 
                />
              </div>
            </div>

            {testResult && !isEditDialogOpen && (
              <div className={`flex items-center gap-2 text-sm p-3 rounded-md ${testResult.success ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                {testResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {testResult.message}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button 
                type="button" 
                variant="outline" 
                onClick={(e) => {
                  const form = (e.currentTarget as HTMLButtonElement).form;
                  if (form) handleTestConnection(new FormData(form));
                }}
                disabled={isTesting || isSaving}
              >
                {isTesting ? <Spinner className="mr-2 h-4 w-4 animate-spin" /> : null}
                Test
              </Button>
              <Button type="submit" disabled={isTesting || isSaving}>
                {isSaving ? <Spinner className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add Connection
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Connection</DialogTitle>
            <DialogDescription>
              Update your Redis connection details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => handleSubmit(e, true)} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Connection Name</Label>
              <Input 
                id="edit-name" 
                name="name" 
                defaultValue={editingConfig?.name}
                required 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-host">Host</Label>
                <Input 
                  id="edit-host" 
                  name="host" 
                  defaultValue={editingConfig?.host}
                  required 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-port">Port</Label>
                <Input 
                  id="edit-port" 
                  name="port" 
                  type="number" 
                  defaultValue={editingConfig?.port} 
                  required 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-password">Password (Optional)</Label>
                <Input 
                  id="edit-password" 
                  name="password" 
                  type="password" 
                  placeholder="••••••••"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-db">Database Index</Label>
                <Input 
                  id="edit-db" 
                  name="db" 
                  type="number" 
                  defaultValue={editingConfig?.db} 
                  required 
                />
              </div>
            </div>

            {testResult && isEditDialogOpen && (
              <div className={`flex items-center gap-2 text-sm p-3 rounded-md ${testResult.success ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                {testResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {testResult.message}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button 
                type="button" 
                variant="outline" 
                onClick={(e) => {
                  const form = (e.currentTarget as HTMLButtonElement).form;
                  if (form) handleTestConnection(new FormData(form));
                }}
                disabled={isTesting || isSaving}
              >
                {isTesting ? <Spinner className="mr-2 h-4 w-4 animate-spin" /> : null}
                Test
              </Button>
              <Button type="submit" disabled={isTesting || isSaving}>
                {isSaving ? <Spinner className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
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
