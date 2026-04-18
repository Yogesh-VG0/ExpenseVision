"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  Sparkles,
  ChevronDown,
  Bell,
  FileUp,
  Download,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { CurrencyProvider } from "@/components/currency-provider";
import { usePWAInstall } from "@/components/pwa-provider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/budgets", label: "Budgets", icon: Wallet },
  { href: "/receipts", label: "Receipts", icon: Camera },
  { href: "/insights", label: "AI Insights", icon: Brain },
];

interface AppShellProps {
  children: React.ReactNode;
  user: { email: string; full_name: string | null; avatar_url: string | null } | null;
  isDemo?: boolean;
}

export function AppShell({ children, user, isDemo = false }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileNavState, setMobileNavState] = useState({
    hidden: false,
    pathname,
  });
  const { isInstalled, install } = usePWAInstall();
  const mainRef = useRef<HTMLElement | null>(null);
  const isImmersiveCapture = !isDemo && pathname === "/receipts/capture";
  const visibleNavItems = navItems;
  const mobileNavHidden = mobileNavState.pathname === pathname ? mobileNavState.hidden : false;

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

  useEffect(() => {
    const scrollContainer = mainRef.current;
    if (!scrollContainer) return;

    let lastScrollTop = scrollContainer.scrollTop;

    const handleScroll = () => {
      const currentScrollTop = scrollContainer.scrollTop;

      if (currentScrollTop < 24) {
        setMobileNavState((current) => {
          if (!current.hidden && current.pathname === pathname) {
            return current;
          }

          return { hidden: false, pathname };
        });
        lastScrollTop = currentScrollTop;
        return;
      }

      if (Math.abs(currentScrollTop - lastScrollTop) < 10) {
        return;
      }

      setMobileNavState((current) => {
        const nextHidden = currentScrollTop > lastScrollTop;

        if (current.hidden === nextHidden && current.pathname === pathname) {
          return current;
        }

        return { hidden: nextHidden, pathname };
      });
      lastScrollTop = currentScrollTop;
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, [pathname]);

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
        !mobile && "w-64 overflow-hidden border-r border-sidebar-border bg-sidebar/95 text-sidebar-foreground supports-backdrop-filter:backdrop-blur-xl"
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

      {/* Settings + Install */}
      <div className="space-y-1 border-t border-border p-3">
        {!isInstalled && (
          <button
            onClick={() => install()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          >
            <Download className="h-5 w-5" />
            Install App
          </button>
        )}
        <Link
          href={isDemo ? "/demo/settings" : "/settings"}
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

  const renderProfileMenu = () => {
    if (isDemo) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="flex items-center gap-2 px-1.5 sm:px-2" />
            }
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-xs text-primary">
                DU
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:block">Demo</span>
            <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-56 border-border/80 bg-popover/95 shadow-2xl">
            <DropdownMenuItem render={<Link href="/demo/settings" />} className="cursor-pointer py-2 px-3">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            {!isInstalled && (
              <DropdownMenuItem onClick={install} className="cursor-pointer py-2 px-3">
                <Download className="mr-2 h-4 w-4" />
                Install App
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/signup" />} className="cursor-pointer py-2 px-3">
              <Sparkles className="mr-2 h-4 w-4" />
              Sign Up Free
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" className="flex items-center gap-1.5 px-1.5 sm:gap-2 sm:px-2" />
          }
        >
          <Avatar className="h-8 w-8">
            {user?.avatar_url && <AvatarImage src={user.avatar_url} alt={displayName} />}
            <AvatarFallback className="bg-primary/10 text-[10px] text-primary sm:text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[120px] truncate text-sm font-medium sm:block">
            {displayName}
          </span>
          <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-56 border-border/80 bg-popover/95 shadow-2xl">
          <DropdownMenuItem render={<Link href="/settings" />} className="cursor-pointer py-2 px-3">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/imports" />} className="cursor-pointer py-2 px-3">
            <FileUp className="mr-2 h-4 w-4" />
            Import
          </DropdownMenuItem>
          {!isInstalled && (
            <DropdownMenuItem onClick={install} className="cursor-pointer py-2 px-3">
              <Download className="mr-2 h-4 w-4" />
              Install App
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer py-2 px-3" variant="destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className={cn("flex h-screen overflow-hidden bg-background", isImmersiveCapture && "h-dvh") }>
      {!isImmersiveCapture && (
        <aside className="hidden md:block">
          {renderSidebar()}
        </aside>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {!isImmersiveCapture && (
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/80 px-3 supports-backdrop-filter:backdrop-blur-xl sm:h-16 sm:px-4 md:px-6">
            <div className="flex items-center gap-2">
              <Link href="/" className="flex items-center gap-2 md:hidden">
                <Image
                  src="/minimal_optimized_for_favicon.png"
                  alt="ExpenseVision logo"
                  width={34}
                  height={34}
                  className="rounded-md"
                />
                <span className="sr-only">ExpenseVision</span>
              </Link>

              {isDemo && (
                <div className="hidden items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent sm:flex">
                  <Sparkles className="h-3 w-3" />
                  <span className="hidden md:inline">Demo Mode — Data is read-only</span>
                  <span className="md:hidden">Demo</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3">
              {!isDemo && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9"
                  render={<Link href="/notifications" />}
                  aria-label="Notifications"
                >
                  <Bell className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
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
                <Button size="sm" render={<Link href="/signup" />} className="hidden sm:inline-flex">
                  <span className="hidden sm:inline">Sign Up Free</span>
                  <span className="sm:hidden">Sign Up</span>
                </Button>
              ) : (
                renderProfileMenu()
              )}
              {isDemo && <div className="sm:hidden">{renderProfileMenu()}</div>}
            </div>
          </header>
        )}

        <main
          ref={mainRef}
          className={cn(
            "flex-1 overflow-y-auto",
            isImmersiveCapture
              ? "p-0 pb-24 md:pb-0"
              : "animate-fade-up p-4 pb-24 md:p-6 md:pb-6"
          )}
          style={isImmersiveCapture ? undefined : { animationDelay: "100ms" }}
        >
          <CurrencyProvider>{children}</CurrencyProvider>
        </main>
      </div>

      <nav
          className={cn(
            "fixed inset-x-3 bottom-3 z-40 transition-all duration-300 ease-out md:hidden",
            mobileNavHidden
              ? "pointer-events-none translate-y-[calc(100%+1rem)] opacity-0"
              : "translate-y-0 opacity-100"
          )}
          aria-label="Primary navigation"
        >
          <div
            className="isolate translate-z-0 transform-gpu rounded-2xl border border-border/80 bg-background/90 px-2 pt-2 shadow-2xl supports-backdrop-filter:backdrop-blur-xl"
            style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="grid grid-cols-5 gap-1">
              {visibleNavItems.map((item) => {
                const demoHref = `/demo${item.href === "/dashboard" ? "" : item.href}`;
                const href = isDemo ? demoHref : item.href;
                const isActive = isDemo
                  ? pathname === demoHref || (demoHref !== "/demo" && pathname.startsWith(demoHref + "/"))
                  : pathname === item.href || pathname.startsWith(item.href + "/");

                return (
                  <Link
                    key={item.href}
                    href={href}
                    scroll={false}
                    aria-current={isActive ? "page" : undefined}
                    onClick={(e) => {
                      // Same-route clicks were causing mobile repaint / focus flashes (white streak).
                      if (isActive) e.preventDefault();
                    }}
                    className={cn(
                      "flex min-w-0 touch-manipulation flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors",
                      "outline-none [-webkit-tap-highlight-color:transparent]",
                      "focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-0",
                      isActive
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4.5 w-4.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
    </div>
  );
}
