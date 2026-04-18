"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { toast } from "sonner";
import {
  User,
  Shield,
  Settings2,
  Database,
  Download,
  Moon,
  Sun,
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useCurrency } from "@/components/currency-provider";

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

const DEMO_TOAST_TITLE = "Sign up to save settings!";
const DEMO_TOAST_DESC = "Create a free account to customize your experience.";

function showDemoToast() {
  toast(DEMO_TOAST_TITLE, { description: DEMO_TOAST_DESC });
}

export default function DemoSettingsPage() {
  const { theme, setTheme } = useTheme();
  const {
    currency: activeCurrency,
    setCurrency: applyCurrencyPreference,
  } = useCurrency();
  const [fullName, setFullName] = useState("Demo User");
  const [currency, setCurrency] = useState(activeCurrency);
  const [budgetAlerts, setBudgetAlerts] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(false);

  useEffect(() => {
    setCurrency(activeCurrency);
  }, [activeCurrency]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-up">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <Badge
            variant="outline"
            className="animate-pulse-glow border-amber-600/45 text-amber-800 dark:border-amber-400/40 dark:text-amber-400"
          >
            Demo
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Manage your account, preferences, and data
        </p>
      </div>

      <Tabs defaultValue="profile" className="animate-fade-up" style={{ animationDelay: "100ms" }}>
        <TabsList className="grid w-full grid-cols-4 sm:w-auto sm:inline-grid">
          <TabsTrigger value="profile">
            <User className="mr-2 h-4 w-4 hidden sm:inline-block" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="preferences">
            <Settings2 className="mr-2 h-4 w-4 hidden sm:inline-block" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="mr-2 h-4 w-4 hidden sm:inline-block" />
            Security
          </TabsTrigger>
          <TabsTrigger value="data">
            <Database className="mr-2 h-4 w-4 hidden sm:inline-block" />
            Data
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6 mt-6">
          <Card className="border-border/50 bg-card/80 backdrop-blur-md">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your display name and profile photo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/10 text-lg text-primary">
                    DU
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">Demo User</p>
                  <p className="text-sm text-muted-foreground">demo@expensevision.tech</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={showDemoToast}>
                <Check className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6 mt-6">
          <Card className="border-border/50 bg-card/80 backdrop-blur-md">
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize the look and feel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Theme</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose between light and dark mode
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border p-1">
                  <Button
                    variant={theme === "light" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setTheme("light")}
                    className="h-8 px-3"
                  >
                    <Sun className="mr-1 h-4 w-4" />
                    Light
                  </Button>
                  <Button
                    variant={theme === "dark" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setTheme("dark")}
                    className="h-8 px-3"
                  >
                    <Moon className="mr-1 h-4 w-4" />
                    Dark
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/80 backdrop-blur-md">
            <CardHeader>
              <CardTitle>Currency</CardTitle>
              <CardDescription>
                Set your preferred display currency
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={currency} onValueChange={(v) => { if (v) setCurrency(v); }}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Select currency" />
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
            <CardFooter>
              <Button
                onClick={() => {
                  applyCurrencyPreference(currency);
                  showDemoToast();
                }}
              >
                <Check className="mr-2 h-4 w-4" />
                Save Currency
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-border/50 bg-card/80 backdrop-blur-md">
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                Configure when you receive alerts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Budget Alerts</p>
                  <p className="text-xs text-muted-foreground">
                    Get notified when approaching budget limits
                  </p>
                </div>
                <Switch
                  checked={budgetAlerts}
                  onCheckedChange={(val) => {
                    setBudgetAlerts(val);
                    showDemoToast();
                  }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Weekly Summary</p>
                  <p className="text-xs text-muted-foreground">
                    Receive a weekly spending summary email
                  </p>
                </div>
                <Switch
                  checked={weeklySummary}
                  onCheckedChange={(val) => {
                    setWeeklySummary(val);
                    showDemoToast();
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6 mt-6">
          <Card className="border-border/50 bg-card/80 backdrop-blur-md">
            <CardHeader>
              <CardTitle>Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input type="password" placeholder="••••••••" disabled />
              </div>
              <div className="space-y-2">
                <Label>Confirm Password</Label>
                <Input type="password" placeholder="••••••••" disabled />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={showDemoToast} disabled>
                Update Password
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Data Tab */}
        <TabsContent value="data" className="space-y-6 mt-6">
          <Card className="border-border/50 bg-card/80 backdrop-blur-md">
            <CardHeader>
              <CardTitle>Export Data</CardTitle>
              <CardDescription>
                Download your expense data in various formats
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={showDemoToast}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button variant="outline" onClick={showDemoToast}>
                <Download className="mr-2 h-4 w-4" />
                Export JSON
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
