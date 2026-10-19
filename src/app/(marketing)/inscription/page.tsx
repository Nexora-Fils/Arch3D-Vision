import type { Metadata } from "next";
import { AccountPlaceholder } from "@/components/account-placeholder";

export const metadata: Metadata = { title: "Inscription" };

export default function SignupPage() {
  return <AccountPlaceholder title="Créer un compte" description="Un compte permettra de partager vos projets avec vos proches." />;
}
