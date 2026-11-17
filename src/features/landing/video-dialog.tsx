"use client";

import { Play } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** « Voir la vidéo »: a real screen recording of the application's 3D view. */
export const VideoDialog = () => (
  <Dialog>
    <DialogTrigger asChild>
      <button type="button" className="flex items-center gap-3 text-sm font-medium text-white/90 hover:text-white">
        <span className="flex size-11 items-center justify-center rounded-full border-2 border-white/80 backdrop-blur">
          <Play className="ml-0.5 size-4 fill-current" aria-hidden />
        </span>
        Voir la vidéo
      </button>
    </DialogTrigger>
    <DialogContent className="max-w-4xl overflow-hidden p-0 sm:max-w-4xl">
      <DialogTitle className="sr-only">Démonstration d&apos;Arch3D Vision</DialogTitle>
      <DialogDescription className="sr-only">Enregistrement de la vue 3D de la maison de démonstration.</DialogDescription>
      <video src="/videos/homeplan-3d-demo.mp4" controls autoPlay muted playsInline className="aspect-video w-full bg-black" />
    </DialogContent>
  </Dialog>
);
