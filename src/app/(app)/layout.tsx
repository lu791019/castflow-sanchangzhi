import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/app-sidebar";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="flex h-12 items-center gap-2 border-b border-ink-200 px-4">
            <SidebarTrigger className="text-ink-600" />
          </div>
          <div className="mx-auto w-full max-w-[1080px] px-6 py-8 md:px-10">
            {children}
          </div>
        </main>
      </SidebarProvider>
    </TooltipProvider>
  );
}
