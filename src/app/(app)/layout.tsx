import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { getCurrentUser } from "@/lib/auth/session";
import { initialsOf } from "@/lib/profile/profile";

const SidebarWithProfile = async () => {
  const user = await getCurrentUser();
  return <AppSidebar profile={user ? { name: user.name, email: user.email, initials: initialsOf(user.name) } : null} />;
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#f4f6f9] md:flex-row">
      <Suspense fallback={<AppSidebar profile={null} isProfilePending />}>
        <SidebarWithProfile />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-24 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
