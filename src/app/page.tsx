import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Armchair, Box, ChevronRight, Footprints, Monitor, Palette, PencilRuler, Save, ShieldCheck, Smile, type LucideIcon } from "lucide-react";
import editorShot from "@/assets/images/editor.jpg";
import heroPhoto from "@/assets/images/photos/hero-house-dusk.jpg";
import showcaseAerial from "@/assets/images/showcase-aerial.jpg";
import showcaseExterior from "@/assets/images/showcase-exterior.jpg";
import showcaseInterior from "@/assets/images/showcase-interior.jpg";
import viewShot from "@/assets/images/view.jpg";
import walkShot from "@/assets/images/walk.jpg";
import { MarketingFooter, MarketingHeader } from "@/components/marketing-header";
import { Button } from "@/components/ui/button";
import { buildDemoPlan } from "@/domain/plan/demo";
import { formatArea } from "@/domain/plan/geometry";
import { planStats } from "@/domain/plan/preview";
import { HOUSE_TEMPLATES } from "@/domain/plan/templates";
import { Showcase } from "@/features/landing/showcase";
import { VideoDialog } from "@/features/landing/video-dialog";
import { TEMPLATE_IMAGES } from "@/features/templates/template-images";
import { openDemoProjectAction } from "@/lib/projects/actions";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  tone: string;
}

const FEATURES: Feature[] = [
  { icon: PencilRuler, title: "Création de plans en 2D", description: "Dessinez facilement les pièces, les murs, les portes et les fenêtres.", tone: "bg-blue-50 text-blue-600 ring-blue-100" },
  { icon: Box, title: "Visualisation en 3D", description: "Générez votre projet en 3D avec un rendu réaliste.", tone: "bg-emerald-50 text-emerald-600 ring-emerald-100" },
  { icon: Footprints, title: "Visite intérieure", description: "Explorez chaque pièce comme si vous y étiez, en mode 360°.", tone: "bg-violet-50 text-violet-600 ring-violet-100" },
  { icon: Palette, title: "Personnalisation", description: "Choisissez vos matériaux, meubles et styles.", tone: "bg-orange-50 text-orange-600 ring-orange-100" },
  { icon: Armchair, title: "Aménagement intérieur", description: "Ajoutez et placez votre mobilier en toute simplicité.", tone: "bg-pink-50 text-pink-600 ring-pink-100" },
  { icon: Save, title: "Sauvegarde & partage", description: "Enregistrez vos projets et partagez-les facilement.", tone: "bg-sky-50 text-sky-600 ring-sky-100" },
];

const HIGHLIGHTS = [
  { icon: PencilRuler, label: "Plan 2D" },
  { icon: Box, label: "Maison 3D" },
  { icon: Footprints, label: "Visite immersive" },
];

const STEPS = [
  { title: "Plan 2D", description: "Dessinez et ajustez votre plan", image: editorShot, target: "editor" as const },
  { title: "Maison 3D", description: "Visualisez votre projet en 3D", image: viewShot, target: "view" as const },
  { title: "Visite intérieure", description: "Explorez comme en vrai", image: walkShot, target: "walk" as const },
];

const TRUST = [
  { icon: Smile, label: "Simple d'utilisation" },
  { icon: ShieldCheck, label: "Sécurisé" },
  { icon: Monitor, label: "Accessible partout" },
];

export default function LandingPage() {
  const demo = buildDemoPlan();
  const stats = planStats(demo);
  return (
    <div className="flex min-h-dvh flex-col bg-[#f4f6f9]">
      <main className="flex-1">
        {/* Hero */}
        <section className="relative min-h-[560px] overflow-hidden bg-midnight text-white md:min-h-[640px]">
          <MarketingHeader transparent />
          <Image src={heroPhoto} alt="Maison contemporaine à deux niveaux aux grandes baies vitrées éclairées, au crépuscule" fill priority sizes="100vw" className="object-cover object-[70%_center]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b1530]/95 via-[#0b1530]/60 to-transparent" aria-hidden />
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#0b1530]/80 to-transparent" aria-hidden />
          <div className="relative mx-auto flex min-h-[560px] w-full max-w-7xl flex-col justify-center gap-6 px-4 pt-24 pb-16 md:min-h-[640px] md:px-8">
            <h1 className="max-w-xl text-4xl leading-[1.05] font-bold tracking-tight md:text-6xl">
              <span className="md:hidden">
                Votre maison
                <br />
                en 3D, <span className="text-[#3b82f6]">simplement</span>
              </span>
              <span className="hidden md:inline">
                Imaginez.
                <br />
                Concevez.
                <br />
                Visitez <span className="text-[#3b82f6]">votre future maison.</span>
              </span>
            </h1>
            <p className="max-w-md text-base text-white/85 md:text-lg">
              Dessinez vos plans, visualisez votre maison en 3D et explorez chaque pièce avant même de poser la première brique.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 px-6 text-base">
                <Link href="/projects/new">
                  Créer ma maison
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <form action={openDemoProjectAction.bind(null, "view")}>
                <Button type="submit" size="lg" variant="outline" className="h-12 border-white/70 bg-transparent px-6 text-base text-white hover:bg-white/10 hover:text-white">
                  <span className="mr-1 flex size-5 items-center justify-center rounded-full border border-current">
                    <span className="ml-0.5 size-0 border-y-[4px] border-l-[6px] border-y-transparent border-l-current" />
                  </span>
                  Découvrir la démo
                </Button>
              </form>
            </div>
            <ul className="mt-6 flex flex-wrap gap-6 text-sm text-white/85">
              {HIGHLIGHTS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2">
                  <Icon className="size-5" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <div className="absolute right-6 bottom-6 hidden md:block">
            <VideoDialog />
          </div>
          <p className="absolute bottom-2 left-4 text-[10px] text-white/40 md:left-8">Photo : Michael Brown, Unsplash</p>
        </section>

        {/* Why */}
        <section id="fonctionnalites" className="mx-auto w-full max-w-7xl px-4 py-16 md:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-midnight md:text-3xl">Pourquoi choisir HomePlan 3D ?</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description, tone }) => (
              <div key={title} className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <span className={`flex size-12 items-center justify-center rounded-xl ring-1 ${tone}`}>
                  <Icon className="size-6" aria-hidden />
                </span>
                <h3 className="mt-4 font-semibold text-midnight">{title}</h3>
                <p className="mt-1.5 text-sm text-slate-500">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Power */}
        <section className="mx-auto w-full max-w-7xl px-4 pb-16 md:px-8">
          <div className="grid gap-8 rounded-3xl bg-white p-6 shadow-sm md:p-8 lg:grid-cols-[1fr_1.15fr]">
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-midnight">Découvrez la puissance de HomePlan 3D</h2>
                <p className="mt-2 text-slate-500">
                  Passez facilement du plan 2D à la maison 3D, puis entrez à l&apos;intérieur <strong className="text-midnight">pour</strong> une expérience complète et immersive.
                </p>
              </div>
              <div className="grid items-start gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
                {STEPS.map((step, index) => (
                  <div key={step.title} className="contents">
                    <form action={openDemoProjectAction.bind(null, step.target)}>
                      <button type="submit" className="group block w-full overflow-hidden rounded-xl border bg-white text-left shadow-sm transition-shadow hover:shadow-md">
                        <span className="relative block aspect-[4/3] overflow-hidden">
                          <Image src={step.image} alt={`Écran : ${step.title}`} fill sizes="(min-width: 1024px) 14vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                        </span>
                        <span className="block p-3">
                          <span className="block text-sm font-semibold text-electric">{step.title}</span>
                          <span className="block text-xs text-slate-500">{step.description}</span>
                        </span>
                      </button>
                    </form>
                    {index < STEPS.length - 1 ? <ChevronRight className="hidden size-5 self-center text-electric sm:block" aria-hidden /> : null}
                  </div>
                ))}
              </div>
            </div>
            <Showcase
              images={[
                { src: showcaseExterior, alt: "Vue extérieure de la maison de démonstration" },
                { src: showcaseInterior, alt: "Séjour de la maison de démonstration" },
                { src: showcaseAerial, alt: "Vue aérienne avec piscine" },
              ]}
              name={demo.name}
              area={formatArea(stats.livingArea)}
              bedrooms={stats.bedrooms}
              openAction={openDemoProjectAction.bind(null, "view")}
            />
          </div>
        </section>

        {/* Mobile: templates list, as in the phone mockup */}
        <section className="mx-auto w-full max-w-7xl px-4 pb-12 md:hidden">
          <h2 className="text-lg font-semibold text-midnight">Nos modèles</h2>
          <div className="mt-3 flex flex-col gap-3">
            {HOUSE_TEMPLATES.slice(0, 3).map((template) => (
              <Link key={template.key} href="/templates" className="flex items-center gap-3 rounded-xl border bg-white p-2 shadow-sm">
                <span className="relative size-16 shrink-0 overflow-hidden rounded-lg">
                  <Image src={TEMPLATE_IMAGES[template.key]} alt="" fill sizes="64px" className="object-cover" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{template.shortName}</span>
                  <span className="line-clamp-2 block text-xs text-slate-500">{template.description}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Call to action */}
        <section className="mx-auto w-full max-w-7xl px-4 pb-16 md:px-8">
          <div className="flex flex-col gap-6 rounded-2xl bg-[#0d1830] px-6 py-6 text-white md:flex-row md:items-center md:justify-between md:px-10">
            <div>
              <h2 className="text-xl font-bold">Prêt à construire la maison de vos rêves ?</h2>
              <p className="mt-1 text-sm text-white/70">Concevez, visualisez et visitez votre future maison dès aujourd&apos;hui.</p>
            </div>
            <Button asChild size="lg" className="h-11 shrink-0 px-6">
              <Link href="/projects/new">
                Commencer maintenant
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <ul className="flex flex-wrap gap-5 text-sm text-white/80">
              {TRUST.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2">
                  <Icon className="size-4" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
