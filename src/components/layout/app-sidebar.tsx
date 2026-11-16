"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Mic,
  CalendarDays,
  Palette,
  Settings,
} from "lucide-react";

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Episodes", href: "/episodes", icon: Mic },
  { title: "Schedule", href: "/schedule", icon: CalendarDays },
  { title: "Styles", href: "/styles", icon: Palette },
  { title: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-ink-200 px-6 py-5">
        <Link href="/dashboard" className="flex flex-col gap-1 no-underline">
          <span className="font-serif-tc text-[17px] font-bold tracking-[0.12em] text-ink-950">
            散場誌
          </span>
          <span className="text-eyebrow tracking-[0.2em] text-ink-600">
            編輯檯
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-eyebrow tracking-[0.18em] text-ink-400">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={pathname.startsWith(item.href)}
                    className="rounded-none border-l-2 border-l-transparent px-4 text-ink-700 data-active:border-l-ember data-active:text-ink-950"
                  >
                    <item.icon className="text-ink-400 group-data-active/menu-button:text-ember-dark" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
