# Portfolio — Nathan Dardalhon

Portfolio personnel de Nathan Dardalhon, développeur full stack en alternance chez Keole / Gazoline
et étudiant en 3ᵉ année de BUT Informatique à l'IUT de Montpellier-Sète.

Site statique, écrit à la main : **aucun framework, aucune étape de build**. Il suffit d'ouvrir
`index.html` (ou de servir le dossier) pour le faire tourner.

---

## Structure

```
index.html            Page principale (hero, profil, stack, projets, parcours, compétences, contact)
alternance.html       Page dédiée à l'alternance Keole / Gazoline
assets/
  css/app.css         Design system complet : tokens, composants, animations, responsive
  js/scene.js         Scène 3D Three.js (shaders GLSL custom, particules, bloom)
  js/app.js           Interactions : préchargement, curseur, révélations, filtres, modales…
img/                  Captures de projets, CV PDF, favicons
legacy/               Ancien thème Bootstrap « DevFolio » conservé pour référence (non utilisé)
```

## Ce qui tourne sous le capot

### Fond 3D (`assets/js/scene.js`)

- **Noyau organique** : icosaèdre déformé dans le *vertex shader* par du bruit simplex 3D
  (implémentation Ashima / Gustavson), avec un rendu additif et un *fresnel* pour le liseré lumineux.
- **Coque filaire** réactive, déformée par un second champ de bruit à une autre fréquence.
- **14 000 particules** (5 000 sur mobile) animées entièrement sur GPU : dérive par bruit,
  respiration, attraction douce vers le curseur, souffle au clic.
- **Trois anneaux orbitaux** en rendu additif.
- **Bloom** via `UnrealBloomPass`, chargé de façon optionnelle : si le post-processing n'est pas
  disponible, la scène bascule automatiquement sur un rendu direct.
- Réactions temps réel à la souris, au scroll et au clic ; le fond s'atténue hors du hero pour
  préserver la lisibilité du texte.

### Dégradations gracieuses

Le site reste entièrement fonctionnel si :

- WebGL est indisponible ou le CDN Three.js injoignable → le fond 3D est simplement absent ;
- l'utilisateur a activé `prefers-reduced-motion` → animations et parallaxes désactivées ;
- JavaScript est désactivé → le contenu HTML reste intégralement lisible.

### Interactions (`assets/js/app.js`)

Préchargement animé, curseur personnalisé avec magnétisme, révélations au scroll
(`IntersectionObserver`), machine à écrire, compteurs animés, filtres de projets, modales de projet
alimentées par des `<template>`, accordéon accessible, carrousel de citations, formulaire de contact
en `mailto:`.

## Dépendances externes (CDN, aucune installation)

| Ressource | Usage |
|---|---|
| Three.js r134 | Rendu 3D |
| Three.js examples (postprocessing) | Bloom |
| Google Fonts — Space Grotesk, Inter, JetBrains Mono | Typographie |
| Font Awesome 6 | Icônes |

## Développement

```bash
npx http-server -p 8777     # puis ouvrir http://localhost:8777
```

Un simple double-clic sur `index.html` fonctionne aussi : tous les scripts sont chargés en scripts
classiques (pas de modules ES), donc sans blocage CORS en `file://`.

## Licence

Code et contenu © Nathan Dardalhon.
