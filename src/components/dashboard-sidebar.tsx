"use client";

import * as React from "react";
import {
  SquaresFourIcon,
  ListIcon,
  UsersIcon,
  DatabaseIcon,
  ShieldCheckIcon,
  CommandIcon,
  SignOutIcon,
  CaretRightIcon,
  CircleIcon,
} from "@phosphor-icons/react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

interface Queue {
  id: string;
  name: string;
  displayName: string;
}

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: SquaresFourIcon,
    },
    {
      title: "Queues",
      url: "/dashboard/queues",
      icon: ListIcon,
    },
    {
      title: "Users",
      url: "/dashboard/users",
      icon: UsersIcon,
    },
    {
      title: "Redis Configs",
      url: "/dashboard/redis",
      icon: DatabaseIcon,
    },
    {
      title: "Role Management",
      url: "/dashboard/roles",
      icon: ShieldCheckIcon,
    },
  ],
};

export function DashboardSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const [queues, setQueues] = React.useState<Queue[]>([]);

  React.useEffect(() => {
    const fetchQueues = async () => {
      try {
        const res = await fetch("/api/queue");
        const data = await res.json();
        setQueues(data);
      } catch (error) {
        console.error("Failed to fetch queues for sidebar:", error);
      }
    };

    fetchQueues();

    // Listen for custom event to re-fetch
    window.addEventListener("queues-changed", fetchQueues);
    return () => window.removeEventListener("queues-changed", fetchQueues);
  }, []);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <CommandIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-base leading-tight">
                  <span className="truncate font-semibold">BullMonitor</span>
                  <span className="truncate text-sm">v1.0.0</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.navMain.map((item) => {
                if (item.title === "Queues") {
                  return (
                    <Collapsible key={item.title} asChild className="group/collapsible">
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={pathname === item.url || pathname.startsWith("/dashboard/queues/")} tooltip={item.title}>
                          <Link href={item.url}>
                            <item.icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuAction className="transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90">
                            <CaretRightIcon />
                            <span className="sr-only">Toggle</span>
                          </SidebarMenuAction>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {queues.length === 0 ? (
                              <SidebarMenuSubItem>
                                <div className="px-2 py-1 text-xs text-muted-foreground italic">
                                  No queues found
                                </div>
                              </SidebarMenuSubItem>
                            ) : (
                              queues.map((queue) => (
                                <SidebarMenuSubItem key={queue.id}>
                                  <SidebarMenuSubButton asChild isActive={pathname === `/dashboard/queues/${queue.id}`}>
                                    <Link href={`/dashboard/queues/${queue.id}`}>
                                      <span>{queue.displayName}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))
                            )}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.url}
                      tooltip={item.title}
                    >
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={async () => {
                await authClient.signOut();
                window.location.href = "/login";
              }}
            >
              <SignOutIcon />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
