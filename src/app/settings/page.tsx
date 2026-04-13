import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "./settings-client";
import type { Profile } from "@/lib/types";

export const metadata = {
  title: "Settings",
  description: "Manage your profile, preferences, and account settings.",
};

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const userProfile: Profile = profile
    ? (profile as Profile)
    : {
        id: user.id,
        email: user.email ?? "",
        full_name: user.user_metadata?.full_name ?? null,
        avatar_url: user.user_metadata?.avatar_url ?? null,
        currency: "USD",
        created_at: user.created_at,
      };

  return <SettingsClient profile={userProfile} />;
}
