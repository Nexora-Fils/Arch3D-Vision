# Licences des images

## Identité visuelle

`public/brand-mark.png`, `public/brand-wordmark.png` et `public/brand-wordmark-inverted.png` sont des déclinaisons générées localement à partir du logo généré avec Gemini pour le ticket ARCH3D-30 (pièce jointe d'origine nommée `Gemini_Generated_Image_…`). Le fichier source reçu était horodaté le 2026-11-03 ; la date exacte de génération n'est pas disponible dans les métadonnées fournies. `src/app/icon.svg` reprend son symbole et `src/app/apple-icon.png` en est une déclinaison pour les appareils Apple. Ces éléments sont réservés à l'identité visuelle du projet ; aucune licence libre distincte n'est revendiquée.

## Photos

| Fichier | Auteur | Source | Licence |
|---|---|---|---|
| `photos/hero-house-dusk.jpg` | Michael Brown (@vettexan) | https://unsplash.com/photos/modern-luxury-home-with-large-windows-at-dusk-G48h926L2qo | [Unsplash License](https://unsplash.com/license) : usage commercial et non commercial, modification autorisée, attribution facultative, revente de l'image telle quelle interdite |

## Rendus de l'application

Tous les autres fichiers de ce dossier (`*.jpg`, `templates/*.jpg`) sont des captures du rendu 3D ou des écrans d'Arch3D Vision, générées localement. Aucune ressource distante n'est chargée à l'exécution.

## Environnements HDR (éclairage par image)

| Fichier | Nom Poly Haven | Licence |
|---|---|---|
| `public/hdri/je_gray_park_2k.hdr` (jour, utilisé) | J&E Gray Park (Greg Zaal) | [CC0](https://polyhaven.com/license) : usage commercial et redistribution autorisés, attribution facultative |
| `public/hdri/sunset_fairway_2k.hdr` (soir, utilisé) | Sunset Fairway (Greg Zaal) | [CC0](https://polyhaven.com/license) |
| `public/hdri/day_1k.hdr` (plus utilisé) | Kloofendal 48d Partly Cloudy (Pure Sky) | [CC0](https://polyhaven.com/license) |
| `public/hdri/evening_1k.hdr` (plus utilisé) | Kiara 1 Dawn | [CC0](https://polyhaven.com/license) |

## Bibliothèques de rendu ajoutées

`@react-three/postprocessing` et `postprocessing` (licence Zlib), pour l'occlusion ambiante, la lueur, le tone mapping et l'anticrénelage.

## Textures photographiques PBR (`public/textures/`)

Jeux couleur + normales + rugosité, 1k, licence [CC0](https://polyhaven.com/license) (Poly Haven) : `laminate_floor_02`, `wood_floor_deck`, `brown_planks_05`, `white_plaster_02`, `large_sandstone_blocks_01`, `grey_roof_tiles_02`, `roof_slates_02`, `clay_roof_tiles`, `concrete_floor_02`, `patio_tiles`, `long_white_tiles`, `large_grey_tiles`, `leafy_grass`, `gravel_floor_02`, `rough_linen`, `concrete_wall_008` (béton banché), `bark_brown_02` (écorce), `clay_roof_tiles_02` (tuiles, remplace `clay_roof_tiles`, conservé mais plus chargé).

L'atlas des feuilles (haies et arbres) est dessiné par le code au chargement (canvas) : aucune ressource externe.

## Modèles 3D scannés (`public/models/`)

Licence [CC0](https://polyhaven.com/license) (Poly Haven), convertis en GLB avec textures WebP 512 px par glTF-Transform : `modern_arm_chair_01`, `dining_chair_02`, `modern_coffee_table_01`, `wooden_table_02`, `bar_chair_round_01`, `potted_plant_01`, `potted_plant_02`, `potted_plant_04`, `modern_wooden_cabinet`, `modern_ceiling_lamp_01`, `ceramic_vase_01`, `shrub_01`, `shrub_04`, `grass_medium_01`.

## Vidéo et rendus de l'application

`public/videos/homeplan-3d-demo.mp4`, `src/assets/images/showcase-*.jpg`, `templates/*.jpg`, `editor.jpg`, `view.jpg`, `walk.jpg` : enregistrements et captures du rendu temps réel d'Arch3D Vision, générés localement.

## Modèles détaillés de maisons (`public/models/houses/`)

Licence [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (attribution obligatoire, usage commercial autorisé), vérifiée sur la page Sketchfab de chaque modèle. Fichiers obtenus via le jeu de données [Objaverse](https://huggingface.co/datasets/allenai/objaverse) (ODC-By), puis optimisés pour le web par glTF-Transform (textures WebP 2048 px, géométrie meshopt) ; aucune autre modification. L'attribution est affichée dans la galerie et dans la vue 3D de chaque modèle.

| Fichier | Titre | Auteur | Source |
|---|---|---|---|
| `villa-aalsmeer.glb` | Villa Aalsmeer 7 | pjotr.van.schothorst | https://sketchfab.com/3d-models/63bf1b1ade914643b3b866d3bbae988a |
| `duplex-house.glb` | Duplex House | jimbogies | https://sketchfab.com/3d-models/9bce4b9490ce43b18900e2e99e8ebe66 |
| `green-residence.glb` | White Silver Green Residence | Francesco Coldesina (topfrank2013) | https://sketchfab.com/3d-models/ec516ba32f03403f97954472c5d4b2cf |

Les miniatures `templates/detailed/*.jpg` sont des captures de ces modèles dans la vue 3D de l'application.
