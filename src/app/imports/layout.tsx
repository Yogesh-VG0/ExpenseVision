import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { buildLoginRedirectPath } from "@/lib/utils";

export default async function ImportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(buildLoginRedirectPath("/imports"));
  }

  return (
    <AppShell
      user={{
        email: user.email || "",
        full_name: user.user_metadata?.full_name || null,
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      }}
    >
      {children}
    </AppShell>
  );
}
