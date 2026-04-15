"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  Camera,
  Brain,
  Settings,
  LogOut,
  Menu,
  Sparkles,
  ChevronDown,
  Bell,
  FileUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { CurrencyProvider } from "@/components/currency-provider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/budgets", label: "Budgets", icon: Wallet },
  { href: "/receipts", label: "Receipts", icon: Camera },
  { href: "/insights", label: "AI Insights", icon: Brain },
  { href: "/imports", label: "Import", icon: FileUp },
];

interface AppShellProps {
  children: React.ReactNode;
  user: { email: string; full_name: string | null; avatar_url: string | null } | null;
  isDemo?: boolean;
}

export function AppShell({ children, user, isDemo = false }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const isImmersiveCapture = !isDemo && pathname === "/receipts/capture";
  const visibleNavItems = isDemo
    ? navItems.filter((item) => item.href !== "/imports")
    : navItems;

  const fetchUnreadCount = useCallback(async () => {
    if (isDemo) return;
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch { /* ignore */ }
  }, [isDemo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchUnreadCount();
    // Poll every 60s for new notifications
    const interval = setInterval(() => void fetchUnreadCount(), 60_000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const displayName = user?.full_name || user?.email?.split("@")[0] || "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.push("/");
    router.refresh();
  };

  const renderSidebar = (mobile = false) => (
    <div
      className={cn(
        "flex h-full flex-col",
        !mobile && "w-64 border-r border-border bg-card/50 backdrop-blur-xl"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <Link href="/" className="group flex items-center gap-2">
          <Image
            src="/minimal_optimized_for_favicon.png"
            alt="ExpenseVision logo"
            width={50}
            height={50}
            className="transition-transform duration-300 group-hover:scale-110"
          />
          <span className="text-lg font-bold">ExpenseVision</span>
        </Link>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 space-y-1 p-3">
        {visibleNavItems.map((item, index) => {
          const demoHref = `/demo${item.href === "/dashboard" ? "" : item.href}`;
          const href = isDemo ? demoHref : item.href;
          const isActive = isDemo
            ? pathname === demoHref || (demoHref !== "/demo" && pathname.startsWith(demoHref + "/"))
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={href}
              onClick={() => mobile && setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/15 text-primary border border-primary/20 shadow-sm"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
              style={!mobile ? { animationDelay: `${index * 50}ms` } : undefined}
            >
              <item.icon className={cn("h-5 w-5 transition-transform duration-200", isActive && "scale-110")} />
              {item.label}
              {isActive && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Settings link */}
      <div className="border-t border-border p-3">
        <Link
          href={isDemo ? "/demo/settings" : "/settings"}
          onClick={() => mobile && setMobileOpen(false)}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            pathname === "/settings" || pathname === "/demo/settings"
              ? "bg-primary/15 text-primary border border-primary/20"
              : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          )}
        >
          <Settings className="h-5 w-5" />
          Settings
        </Link>
      </div>
    </div>
  );

  return (
    <div className={cn("flex h-screen overflow-hidden bg-background", isImmersiveCapture && "h-dvh") }>
      {!isImmersiveCapture && (
        <aside className="hidden md:block">
          {renderSidebar()}
        </aside>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {!isImmersiveCapture && (
          <header className="flex h-16 items-center justify-between border-b border-border bg-card/50 px-4 backdrop-blur-xl md:px-6">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                {renderSidebar(true)}
              </SheetContent>
            </Sheet>

            {isDemo && (
              <div className="hidden items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent md:flex">
                <Sparkles className="h-3 w-3" />
                Demo Mode — Data is read-only
              </div>
            )}

            <div className="flex-1" />

            <div className="flex items-center gap-3">
              {/* Notification bell */}
              {!isDemo && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  render={<Link href="/notifications" />}
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full px-1 text-[10px] font-semibold"
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Badge>
                  )}
                </Button>
              )}

              <ThemeToggle />

              {isDemo ? (
                <Button size="sm" render={<Link href="/signup" />}>Sign Up Free</Button>
              ) : (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" className="flex items-center gap-2 px-2" />}>
                    <Avatar className="h-8 w-8">
                      {user?.avatar_url && (
                        <AvatarImage src={user.avatar_url} alt={displayName} />
                      )}
                      <AvatarFallback className="bg-primary/10 text-xs text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden text-sm font-medium sm:block">
                      {displayName}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 border border-border bg-popover shadow-xl">
                  <DropdownMenuItem render={<Link href="/settings" />} className="cursor-pointer py-2 px-3">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer py-2 px-3">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            </div>
          </header>
        )}

        <main
          className={cn(
            "flex-1 overflow-y-auto",
            isImmersiveCapture ? "p-0" : "animate-fade-up p-4 md:p-6"
          )}
          style={isImmersiveCapture ? undefined : { animationDelay: "100ms" }}
        >
          {isDemo ? children : <CurrencyProvider>{children}</CurrencyProvider>}
        </main>
      </div>
    </div>
  );
}
