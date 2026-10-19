import { MarketingFooter, MarketingHeader } from "@/components/marketing-header";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <MarketingHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-12">{children}</main>
      <MarketingFooter />
    </div>
  );
}
