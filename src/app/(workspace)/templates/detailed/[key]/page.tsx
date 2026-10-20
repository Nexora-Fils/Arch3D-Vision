import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DETAILED_HOUSES, findDetailedHouse } from "@/features/detailed-houses/catalog";
import { DetailedHouseScreen } from "@/features/detailed-houses/detailed-house-screen";

interface DetailedHousePageProps {
  params: Promise<{ key: string }>;
}

export const generateStaticParams = () => DETAILED_HOUSES.map((house) => ({ key: house.key }));

export const generateMetadata = async ({ params }: DetailedHousePageProps): Promise<Metadata> => {
  const house = findDetailedHouse((await params).key);
  return { title: house ? house.name : "Modèle introuvable" };
};

export default function DetailedHousePage({ params }: DetailedHousePageProps) {
  return (
    <Suspense fallback={<div className="h-dvh w-full bg-[#0d1830]" />}>
      <DetailedHouseLoader params={params} />
    </Suspense>
  );
}

const DetailedHouseLoader = async ({ params }: DetailedHousePageProps) => {
  const house = findDetailedHouse((await params).key);
  if (!house) notFound();
  return <DetailedHouseScreen house={house} />;
};
