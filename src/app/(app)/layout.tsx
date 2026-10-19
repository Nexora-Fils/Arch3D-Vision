import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { getProfile, initialsOf } from "@/lib/profile/profile";

const SidebarWithProfile = async () => {
  const profile = await getProfile();
  return <AppSidebar profile={{ ...profile, initials: initialsOf(profile.name) }} />;
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#f4f6f9] md:flex-row">
      <Suspense fallback={<AppSidebar profile={null} />}>
        <SidebarWithProfile />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-24 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
