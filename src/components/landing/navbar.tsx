"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Menu, LayoutDashboard, Settings, LogOut, ChevronDown, Download } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { usePWAInstall } from "@/components/pwa-provider";
import { toast } from "sonner";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "AI Insights", href: "#ai" },
  { label: "Security", href: "#security" },
];

export function Navbar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { isInstalled, install } = usePWAInstall();
  const [user, setUser] = useState<{
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const loadUser = (authUser: { id: string; email?: string | null; user_metadata?: Record<string, string> } | null) => {
      if (!authUser) {
        setUser(null);
        return;
      }
      supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", authUser.id)
        .single()
        .then(({ data }) => {
          const name = data?.full_name?.trim() || authUser.user_metadata?.full_name?.trim() || null;
          const avatar =
            data?.avatar_url ||
            authUser.user_metadata?.avatar_url ||
            authUser.user_metadata?.picture ||
            null;
          setUser({
            email: authUser.email ?? "",
            full_name: name || null,
            avatar_url: avatar,
          });
        });
    };

    supabase.auth.getUser().then(({ data: { user: authUser } }) => loadUser(authUser));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const isSignedIn = !!user;
  const displayName = user?.full_name || user?.email?.split("@")[0] || "User";
  const initials = (displayName.match(/\b\w/g) || ["U"])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out");
    setUser(null);
    router.push("/");
    router.refresh();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/60 backdrop-blur-xl animate-fade-down">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2 text-lg font-bold">
          <Image
            src="/minimal_optimized_for_favicon.png"
            alt="ExpenseVision logo"
            width={50}
            height={50}
            className="transition-transform duration-300 group-hover:scale-110"
          />
          <span>ExpenseVision</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors duration-200 hover:text-primary"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-3 md:flex">
          {!isInstalled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={install}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <Download className="h-4 w-4" />
              <span className="hidden lg:inline">Install App</span>
            </Button>
          )}
          <ThemeToggle />
          {isSignedIn ? (
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" render={<Link href="/dashboard" />}>
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" className="flex items-center gap-2 px-2" />}>
                  <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                    <AvatarImage src={user?.avatar_url || ""} alt={displayName} />
                    <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm font-medium lg:block">
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
            </div>
          ) : (
            <>
              <Button variant="ghost" render={<Link href="/signup" />}>
                Get Started
              </Button>
              <Button
                render={<Link href="/demo" />}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Try Demo
              </Button>
            </>
          )}
        </div>

        {/* Mobile Menu */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <nav className="flex flex-col gap-2 pt-6">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <hr className="my-4 border-border" />
            <div className="flex flex-col gap-3 px-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Theme</span>
                <ThemeToggle />
              </div>
              {!isInstalled && (
                <button
                  onClick={() => { setOpen(false); install(); }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                >
                  <Download className="h-5 w-5" />
                  Install App
                </button>
              )}
              {isSignedIn ? (
                <>
                  <Button className="w-full" render={<Link href="/dashboard" onClick={() => setOpen(false)} />}>
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </Button>
                  <Button variant="outline" className="w-full" render={<Link href="/settings" onClick={() => setOpen(false)} />}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Button>
                  <Button variant="ghost" className="w-full text-destructive" onClick={() => { setOpen(false); handleSignOut(); }}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" className="w-full" render={<Link href="/signup" onClick={() => setOpen(false)} />}>
                    Get Started
                  </Button>
                  <Button className="w-full" render={<Link href="/demo" onClick={() => setOpen(false)} />}>
                    Try Demo
                  </Button>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
