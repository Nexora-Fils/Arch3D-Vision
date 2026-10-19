import type { Metadata } from "next";
import { Suspense } from "react";
import { Database, LockOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileForm } from "@/features/settings/profile-form";
import { getProfile } from "@/lib/profile/profile";
import { getDatabaseStatus } from "@/lib/projects/repository";
import packageJson from "../../../../package.json";

export const metadata: Metadata = { title: "Paramètres" };

export default function AppSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-midnight">Paramètres</h1>
        <p className="text-sm text-muted-foreground">État de l&apos;application. Les réglages d&apos;une maison se trouvent dans son onglet Paramètres.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-4 text-electric" aria-hidden />
              Base de données
            </CardTitle>
            <CardDescription>PostgreSQL dans Docker Desktop, accès via Prisma côté serveur uniquement.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-16" />}>
              <DatabaseStatus />
            </Suspense>
          </CardContent>
        </Card>
        <Card id="mon-compte">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockOpen className="size-4 text-electric" aria-hidden />
              Mon compte
            </CardTitle>
            <CardDescription>Le prototype fonctionne sans authentification ; chaque projet prévoit déjà un propriétaire.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-40" />}>
              <ProfileSection />
            </Suspense>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Application</CardTitle>
            <CardDescription>HomePlan 3D version {packageJson.version}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {["Next.js", "React", "TypeScript", "Tailwind CSS", "shadcn/ui", "Prisma", "PostgreSQL", "React Three Fiber", "React Konva", "Zustand", "Zod"].map((name) => (
              <Badge key={name} variant="secondary">
                {name}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const DatabaseStatus = async () => {
  const status = await getDatabaseStatus();
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <dt className="text-muted-foreground">État</dt>
      <dd>
        <Badge className="bg-emerald-600 text-white">Connectée</Badge>
      </dd>
      <dt className="text-muted-foreground">Serveur</dt>
      <dd className="truncate" title={status.version}>
        {status.version.split(" on ")[0]}
      </dd>
      <dt className="text-muted-foreground">Projets</dt>
      <dd className="tabular-nums">{status.projectCount}</dd>
      <dt className="text-muted-foreground">Pièces</dt>
      <dd className="tabular-nums">{status.roomCount}</dd>
    </dl>
  );
};

const ProfileSection = async () => <ProfileForm profile={await getProfile()} />;
