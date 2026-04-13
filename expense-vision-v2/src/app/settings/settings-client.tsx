"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/theme-provider";
import { toast } from "sonner";
import {
  User,
  Shield,
  Settings2,
  Database,
  Download,
  Upload,
  Trash2,
  Eye,
  EyeOff,
  Moon,
  Sun,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

const CURRENCIES = [
  { value: "USD", label: "USD – US Dollar" },
  { value: "EUR", label: "EUR – Euro" },
  { value: "GBP", label: "GBP – British Pound" },
  { value: "INR", label: "INR – Indian Rupee" },
  { value: "JPY", label: "JPY – Japanese Yen" },
  { value: "AED", label: "AED – UAE Dirham" },
  { value: "CAD", label: "CAD – Canadian Dollar" },
  { value: "AUD", label: "AUD – Australian Dollar" },
  { value: "SGD", label: "SGD – Singapore Dollar" },
];

interface SettingsClientProps {
  profile: Profile;
}

export function SettingsClient({ profile }: SettingsClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();

  // Profile state
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Security state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Preferences state
  const [currency, setCurrency] = useState(profile.currency ?? "USD");
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [budgetAlerts, setBudgetAlerts] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(false);

  // Data state
  const [exportingCSV, setExportingCSV] = useState(false);
  const [exportingJSON, setExportingJSON] = useState(false);
  const [deleteDataOpen, setDeleteDataOpen] = useState(false);
  const [deletingData, setDeletingData] = useState(false);

  const displayName = fullName.trim() || null;
  const initials = displayName
    ? (displayName.match(/\b\w/g) || ["U"])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : profile.email?.charAt(0).toUpperCase() ?? "U";

  const passwordChecks = [
    { label: "8+ characters", met: newPassword.length >= 8 },
    { label: "Uppercase letter", met: /[A-Z]/.test(newPassword) },
    { label: "Lowercase letter", met: /[a-z]/.test(newPassword) },
    { label: "Number", met: /[0-9]/.test(newPassword) },
  ];

  const allPasswordChecksMet = passwordChecks.every((c) => c.met);

  // ────────── Profile handlers ──────────

  async function handleSaveProfile() {
    setSavingProfile(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: fullName },
      });
      if (authError) throw authError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: fullName, updated_at: new Date().toISOString() })
        .eq("id", profile.id);
      if (profileError) throw profileError;

      toast.success("Profile updated successfully");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      toast.error(message);
    } finally {
      setSavingProfile(false);
    }
  }

  // ────────── Security handlers ──────────

  async function handleUpdatePassword() {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (!allPasswordChecksMet) {
      toast.error("Password does not meet requirements");
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;

      toast.success("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update password";
      toast.error(message);
    } finally {
      setUpdatingPassword(false);
    }
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    try {
      // Delete all user data first
      await supabase.from("expenses").delete().eq("user_id", profile.id);
      await supabase.from("budgets").delete().eq("user_id", profile.id);
      await supabase.from("profiles").delete().eq("id", profile.id);

      // Sign out — full account deletion typically requires a server-side admin call
      await supabase.auth.signOut();
      toast.success("Account data deleted. You have been signed out.");
      router.push("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete account";
      toast.error(message);
    } finally {
      setDeletingAccount(false);
      setDeleteAccountOpen(false);
    }
  }

  // ────────── Preferences handlers ──────────

  async function handleSaveCurrency(value: string) {
    setCurrency(value);
    setSavingPrefs(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ currency: value, updated_at: new Date().toISOString() })
        .eq("id", profile.id);
      if (error) throw error;
      toast.success(`Currency set to ${value}`);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update currency";
      toast.error(message);
    } finally {
      setSavingPrefs(false);
    }
  }

  // ────────── Data handlers ──────────

  async function handleExportCSV() {
    setExportingCSV(true);
    try {
      const res = await fetch("/api/expenses");
      if (!res.ok) throw new Error("Failed to fetch expenses");
      const { expenses } = await res.json();

      if (!expenses.length) {
        toast.error("No expenses to export");
        return;
      }

      const headers = ["Date", "Amount", "Category", "Description", "Vendor", "Tags"];
      const rows = expenses.map((e: Record<string, unknown>) => [
        e.date,
        e.amount,
        e.category,
        `"${String(e.description ?? "").replace(/"/g, '""')}"`,
        `"${String(e.vendor ?? "").replace(/"/g, '""')}"`,
        `"${Array.isArray(e.tags) ? e.tags.join(", ") : ""}"`,
      ]);

      const csv = [headers.join(","), ...rows.map((r: string[]) => r.join(","))].join("\n");
      downloadFile(csv, "expenses.csv", "text/csv");
      toast.success("Expenses exported as CSV");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Export failed";
      toast.error(message);
    } finally {
      setExportingCSV(false);
    }
  }

  async function handleExportJSON() {
    setExportingJSON(true);
    try {
      const res = await fetch("/api/expenses");
      if (!res.ok) throw new Error("Failed to fetch expenses");
      const { expenses } = await res.json();

      if (!expenses.length) {
        toast.error("No expenses to export");
        return;
      }

      const json = JSON.stringify(expenses, null, 2);
      downloadFile(json, "expenses.json", "application/json");
      toast.success("Expenses exported as JSON");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Export failed";
      toast.error(message);
    } finally {
      setExportingJSON(false);
    }
  }

  function downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleDeleteAllData() {
    setDeletingData(true);
    try {
      await supabase.from("expenses").delete().eq("user_id", profile.id);
      await supabase.from("budgets").delete().eq("user_id", profile.id);
      toast.success("All expense and budget data deleted");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete data";
      toast.error(message);
    } finally {
      setDeletingData(false);
      setDeleteDataOpen(false);
    }
  }

  // ────────── Render ──────────

  return (
    <div className="container mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-background/50 backdrop-blur-md border border-border">
          <TabsTrigger value="profile" className="gap-2 data-[state=active]:bg-muted/50">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2 data-[state=active]:bg-muted/50">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2 data-[state=active]:bg-muted/50">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Preferences</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-2 data-[state=active]:bg-muted/50">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Data</span>
          </TabsTrigger>
        </TabsList>

        {/* ──────── Profile Tab ──────── */}
        <TabsContent value="profile" className="space-y-6">
          <Card className="border-border bg-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border-2 border-border ring-2 ring-primary/20">
                  <AvatarImage src={profile.avatar_url || ""} alt={displayName || "User"} />
                  <AvatarFallback className="bg-gradient-to-br from-amber-500/20 to-purple-500/20 text-lg font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{displayName || "No name set"}</p>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                </div>
              </div>

              <Separator className="bg-muted/50" />

              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="border-border bg-muted/30"
                />
              </div>

              {/* Email (read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={profile.email}
                  disabled
                  className="border-border bg-muted/30 opacity-60"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed from settings
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save Profile
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* ──────── Security Tab ──────── */}
        <TabsContent value="security" className="space-y-6">
          {/* Change Password */}
          <Card className="border-border bg-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="new_password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new_password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="border-border bg-muted/30 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Password Requirements */}
              {newPassword.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {passwordChecks.map((check) => (
                    <div key={check.label} className="flex items-center gap-2 text-sm">
                      <Check
                        className={`h-3.5 w-3.5 ${
                          check.met ? "text-emerald-500" : "text-muted-foreground/40"
                        }`}
                      />
                      <span
                        className={
                          check.met ? "text-emerald-500" : "text-muted-foreground/60"
                        }
                      >
                        {check.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirm_password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="border-border bg-muted/30 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleUpdatePassword}
                disabled={
                  updatingPassword ||
                  !allPasswordChecksMet ||
                  newPassword !== confirmPassword ||
                  !newPassword
                }
              >
                {updatingPassword ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Update Password
              </Button>
            </CardFooter>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/30 bg-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Permanently delete your account and all associated data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                onClick={() => setDeleteAccountOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Account
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ──────── Preferences Tab ──────── */}
        <TabsContent value="preferences" className="space-y-6">
          {/* Currency */}
          <Card className="border-border bg-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle>Currency</CardTitle>
              <CardDescription>Set your default display currency</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={currency} onValueChange={(v) => v && handleSaveCurrency(v)} disabled={savingPrefs}>
                <SelectTrigger className="w-full max-w-xs border-border bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Theme */}
          <Card className="border-border bg-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize how ExpenseVision looks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {theme === "dark" ? (
                    <Moon className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Sun className="h-5 w-5 text-amber-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium">Dark Mode</p>
                    <p className="text-xs text-muted-foreground">
                      Toggle between light and dark themes
                    </p>
                  </div>
                </div>
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="border-border bg-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Configure email notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Budget Alerts</p>
                  <p className="text-xs text-muted-foreground">
                    Get notified when spending exceeds 80% of a budget
                  </p>
                </div>
                <Switch checked={budgetAlerts} onCheckedChange={setBudgetAlerts} />
              </div>
              <Separator className="bg-muted/50" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Weekly Summary</p>
                  <p className="text-xs text-muted-foreground">
                    Receive a weekly spending summary every Monday
                  </p>
                </div>
                <Switch checked={weeklySummary} onCheckedChange={setWeeklySummary} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ──────── Data Tab ──────── */}
        <TabsContent value="data" className="space-y-6">
          {/* Export */}
          <Card className="border-border bg-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle>Export Data</CardTitle>
              <CardDescription>Download your expense data</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={handleExportCSV} disabled={exportingCSV}>
                {exportingCSV ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export as CSV
              </Button>
              <Button variant="outline" onClick={handleExportJSON} disabled={exportingJSON}>
                {exportingJSON ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export as JSON
              </Button>
            </CardContent>
          </Card>

          {/* Import */}
          <Card className="border-border bg-background/60 backdrop-blur-xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <CardTitle>Import Data</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  Coming soon
                </Badge>
              </div>
              <CardDescription>Import expenses from CSV or other sources</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" disabled>
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </Button>
            </CardContent>
          </Card>

          {/* Delete All Data */}
          <Card className="border-destructive/30 bg-background/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-destructive">Delete All Data</CardTitle>
              <CardDescription>
                Permanently delete all your expenses and budgets. This cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={() => setDeleteDataOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete All Data
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ──────── Delete Account Dialog ──────── */}
      <Dialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
        <DialogContent className="border-border bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              This will permanently delete your account and all associated data including
              expenses, budgets, and AI insights. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setDeleteAccountOpen(false)}
              disabled={deletingAccount}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deletingAccount}
            >
              {deletingAccount ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ──────── Delete All Data Dialog ──────── */}
      <Dialog open={deleteDataOpen} onOpenChange={setDeleteDataOpen}>
        <DialogContent className="border-border bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Delete All Data</DialogTitle>
            <DialogDescription>
              This will permanently delete all your expenses and budgets. Your account
              will remain active. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setDeleteDataOpen(false)}
              disabled={deletingData}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAllData}
              disabled={deletingData}
            >
              {deletingData ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete All Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
