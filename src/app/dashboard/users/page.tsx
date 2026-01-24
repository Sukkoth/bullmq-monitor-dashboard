"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DotsThreeIcon, 
  UserIcon, 
  ShieldCheckIcon, 
  TrashIcon, 
  ArrowsClockwiseIcon,
  WarningIcon,
  PlusIcon,
  KeyIcon,
  LockIcon,
  CheckIcon,
  DatabaseIcon,
  ListIcon
} from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function UsersPage() {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create User State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "user" });

  // Access Management State
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [accessData, setAccessData] = useState<{
    queues: { id: string; name: string; displayName: string; isAuthorized: boolean; isOwner: boolean }[];
    redisConfigs: { id: string; name: string; host: string; isAuthorized: boolean; isOwner: boolean }[];
  } | null>(null);
  const [isSavingAccess, setIsSavingAccess] = useState(false);
  const [isFetchingAccess, setIsFetchingAccess] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/users");
      const result = await res.json();
      if (result.success) {
        setUsers(result.data);
      } else {
        toast.error(result.message || "Failed to fetch users");
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("An error occurred while fetching users");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if ((session?.user as any)?.role === "admin") {
      fetchUsers();
    }
  }, [session, fetchUsers]);

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(`User role updated to ${newRole}`);
        fetchUsers();
      } else {
        toast.error(result.message || "Failed to update role");
      }
    } catch (error) {
      toast.error("Failed to update user role");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? Action cannot be undone.")) return;

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (result.success) {
        toast.success("User deleted successfully");
        fetchUsers();
      } else {
        toast.error(result.message || "Failed to delete user");
      }
    } catch (error) {
      toast.error("Failed to delete user");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("User created successfully");
        setIsAddModalOpen(false);
        setNewUser({ name: "", email: "", password: "", role: "user" });
        fetchUsers();
      } else {
        toast.error(result.message || "Failed to create user");
      }
    } catch (error) {
      toast.error("Failed to create user");
    } finally {
      setIsCreating(false);
    }
  };

  const openAccessModal = async (user: User) => {
    setTargetUser(user);
    setIsAccessModalOpen(true);
    setIsFetchingAccess(true);
    try {
      const res = await fetch(`/api/users/${user.id}/access`);
      const result = await res.json();
      if (result.success) {
        setAccessData(result.data);
      } else {
        toast.error(result.message || "Failed to fetch access data");
        setIsAccessModalOpen(false);
      }
    } catch (error) {
      toast.error("An error occurred while fetching access data");
      setIsAccessModalOpen(false);
    } finally {
      setIsFetchingAccess(false);
    }
  };

  const handleUpdateAccess = async () => {
    if (!targetUser || !accessData) return;
    setIsSavingAccess(true);
    try {
      const res = await fetch(`/api/users/${targetUser.id}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queueIds: accessData.queues.filter(q => q.isAuthorized && !q.isOwner).map(q => q.id),
          redisConfigIds: accessData.redisConfigs.filter(c => c.isAuthorized && !c.isOwner).map(c => c.id),
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Access updated successfully");
        setIsAccessModalOpen(false);
      } else {
        toast.error(result.message || "Failed to update access");
      }
    } catch (error) {
      toast.error("An error occurred while updating access");
    } finally {
      setIsSavingAccess(false);
    }
  };

  const toggleAccess = (type: "queues" | "redisConfigs", id: string) => {
    if (!accessData) return;
    setAccessData({
      ...accessData,
      [type]: accessData[type].map(item => 
        item.id === id ? { ...item, isAuthorized: !item.isAuthorized } : item
      )
    });
  };

  if (isSessionPending) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <ArrowsClockwiseIcon className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (session?.user?.role !== "admin") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <WarningIcon className="h-16 w-16 text-yellow-500 opacity-20" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground text-center max-w-md">
          This page is reserved for administrators only. Please contact your system administrator if you believe this is an error.
        </p>
        <Button variant="outline" onClick={() => window.location.href = "/dashboard"}>
          Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Manage system users, roles, and permissions.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchUsers} disabled={isLoading}>
            <ArrowsClockwiseIcon className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Browse and manage all registered accounts in the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[80px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className="group">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.name || "Unnamed User"}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.role === "admin" ? (
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 gap-1 capitalize">
                        <ShieldCheckIcon className="h-3 w-3" />
                        Admin
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 capitalize">
                        <UserIcon className="h-3 w-3" />
                        {user.role}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(user.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <DotsThreeIcon className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="gap-2"
                          onClick={() => openAccessModal(user)}
                        >
                          <LockIcon className="h-4 w-4" />
                          Manage Access
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="gap-2"
                          onClick={() => handleUpdateRole(user.id, user.role === "admin" ? "user" : "admin")}
                        >
                          <ShieldCheckIcon className="h-4 w-4" />
                          {user.role === "admin" ? "Make Regular User" : "Promote to Admin"}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="gap-2 text-destructive focus:text-destructive"
                          disabled={user.id === session?.user?.id}
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <TrashIcon className="h-4 w-4" />
                          Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add User Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <form onSubmit={handleCreateUser}>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new account and assign a role. The user can login with the email and password you provide.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="create-name">Full Name</Label>
                <Input
                  id="create-name"
                  placeholder="John Doe"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-email">Email Address</Label>
                <Input
                  id="create-email"
                  type="email"
                  placeholder="john@example.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-password">Initial Password</Label>
                <Input
                  id="create-password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="create-role">Role</Label>
                <Select 
                  value={newUser.role} 
                  onValueChange={(val) => setNewUser({ ...newUser, role: val })}
                >
                  <SelectTrigger id="create-role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Regular User</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Access Modal */}
      <Dialog open={isAccessModalOpen} onOpenChange={setIsAccessModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Access: {targetUser?.name}</DialogTitle>
            <DialogDescription>
              Assign specific queues and Redis configurations to this user. Owners of a resource always have full access.
            </DialogDescription>
          </DialogHeader>
          
          {isFetchingAccess ? (
            <div className="flex h-64 items-center justify-center">
              <ArrowsClockwiseIcon className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6 py-4">
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <DatabaseIcon className="h-4 w-4" />
                  Redis Configurations
                </h3>
                <div className="border rounded-md overflow-hidden bg-muted/30">
                  <ScrollArea className="h-64 p-1">
                    {accessData?.redisConfigs.map(config => (
                      <div 
                        key={config.id} 
                        className={`flex items-center gap-2 p-2 px-3 rounded-sm transition-colors ${config.isOwner ? "opacity-60 bg-muted/50" : "hover:bg-muted/80 cursor-pointer"}`}
                        onClick={() => !config.isOwner && toggleAccess("redisConfigs", config.id)}
                      >
                        <Checkbox 
                          id={`config-${config.id}`} 
                          checked={config.isAuthorized}
                          disabled={config.isOwner}
                          onCheckedChange={() => !config.isOwner && toggleAccess("redisConfigs", config.id)}
                        />
                        <div className="flex flex-col">
                          <Label 
                            htmlFor={`config-${config.id}`} 
                            className={`text-sm font-medium ${config.isOwner ? "cursor-default" : "cursor-pointer"}`}
                          >
                            {config.name}
                          </Label>
                          <span className="text-[10px] text-muted-foreground">{config.host}</span>
                        </div>
                        {config.isOwner && (
                          <Badge variant="outline" className="ml-auto text-[8px] py-0 h-4 border-primary/20 text-primary bg-primary/5 uppercase">Owner</Badge>
                        )}
                      </div>
                    ))}
                    {accessData?.redisConfigs.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-8 italic">No Redis configs found</div>
                    )}
                  </ScrollArea>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <ListIcon className="h-4 w-4" />
                  Queues
                </h3>
                <div className="border rounded-md overflow-hidden bg-muted/30">
                  <ScrollArea className="h-64 p-1">
                    {accessData?.queues.map(queue => (
                      <div 
                        key={queue.id} 
                        className={`flex items-center gap-2 p-2 px-3 rounded-sm transition-colors ${queue.isOwner ? "opacity-60 bg-muted/50" : "hover:bg-muted/80 cursor-pointer"}`}
                        onClick={() => !queue.isOwner && toggleAccess("queues", queue.id)}
                      >
                        <Checkbox 
                          id={`queue-${queue.id}`} 
                          checked={queue.isAuthorized}
                          disabled={queue.isOwner}
                          onCheckedChange={() => !queue.isOwner && toggleAccess("queues", queue.id)}
                        />
                        <div className="flex flex-col">
                          <Label 
                            htmlFor={`queue-${queue.id}`} 
                            className={`text-sm font-medium ${queue.isOwner ? "cursor-default" : "cursor-pointer"}`}
                          >
                            {queue.displayName}
                          </Label>
                          <span className="text-[10px] text-muted-foreground">{queue.name}</span>
                        </div>
                        {queue.isOwner && (
                          <Badge variant="outline" className="ml-auto text-[8px] py-0 h-4 border-primary/20 text-primary bg-primary/5 uppercase">Owner</Badge>
                        )}
                      </div>
                    ))}
                    {accessData?.queues.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-8 italic">No queues found</div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsAccessModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateAccess} disabled={isSavingAccess || isFetchingAccess}>
              {isSavingAccess ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

