import Link from "next/link";
import { LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AccountPlaceholderProps {
  title: string;
  description: string;
}

/** Login and signup are not part of the prototype: say so, and keep the user moving. */
export const AccountPlaceholder = ({ title, description }: AccountPlaceholderProps) => (
  <Card className="mx-auto w-full max-w-md">
    <CardHeader className="items-center text-center">
      <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-electric/10 text-electric">
        <LockOpen className="size-6" aria-hidden />
      </span>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent className="flex flex-col gap-2">
      <p className="text-center text-sm text-muted-foreground">
        Les comptes utilisateurs arrivent dans une prochaine version. En attendant, le prototype est accessible sans inscription et vos projets sont enregistrés dans votre base de données locale.
      </p>
      <Button asChild className="mt-2">
        <Link href="/dashboard">Accéder au tableau de bord</Link>
      </Button>
    </CardContent>
  </Card>
);
