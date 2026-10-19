import type { Metadata } from "next";
import { AccountPlaceholder } from "@/components/account-placeholder";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return <AccountPlaceholder title="Se connecter" description="Retrouvez vos maisons depuis n'importe quel appareil." />;
}
