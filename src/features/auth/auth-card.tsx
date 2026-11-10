import { KeyRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AuthCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export const AuthCard = ({ title, description, children }: AuthCardProps) => (
  <Card className="mx-auto w-full max-w-md">
    <CardHeader className="items-center text-center">
      <span className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-electric/10 text-electric">
        <KeyRound className="size-6" aria-hidden />
      </span>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);
