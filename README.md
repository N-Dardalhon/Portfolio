# Portfolio — Nathan Dardalhon

Portfolio personnel de Nathan Dardalhon, développeur full stack en alternance chez Keole / Gazoline
et étudiant en 3ᵉ année de BUT Informatique à l'IUT de Montpellier-Sète.

Site statique multi-pages, écrit à la main : **aucun framework, aucune étape de build**.

---

## Pages

| Fichier | Contenu | Scène 3D |
|---|---|---|
| `index.html` | Accueil : hero, profil, chiffres, sélection de projets | Goutte de métal liquide |
| `projets.html` | Galerie interactive + six fiches détaillées | Galerie WebGL + champ de points |
| `parcours.html` | Frise, stack technique, compétences du référentiel BUT | Champ de points |
| `alternance.html` | Missions, projet mybateau.fr, bilan | Champ de points |
| `contact.html` | Formulaire et coordonnées | Goutte (variante discrète) |

## Structure

```
assets/
  css/app.css            Design system : tokens, composants, animations, responsive
  js/three-core.js       Socle 3D : rendu, environnement studio procédural, boucle unique
  js/scene-hero.js       Goutte de métal liquide
  js/scene-field.js      Champ de points ondulant
  js/scene-gallery.js    Galerie de projets en 3D
  js/app.js              Interface : voile, curseur, navigation, révélations, modales…
img/                     Captures de projets, CV PDF, favicons
legacy/                  Ancien thème Bootstrap « DevFolio », conservé pour référence
```

## Les trois scènes 3D

### Goutte de métal liquide — `scene-hero.js`

Un icosaèdre déformé dans le **vertex shader** par du bruit simplex 3D à deux octaves. Les normales
sont **recalculées par différences finies** (deux échantillons sur le plan tangent), sans quoi les
reflets seraient faux sur une surface déformée.

Le chrome est éclairé par une **carte d'environnement studio générée à l'exécution** : un dégradé et
quatre sources lumineuses peints sur un canvas 2D, convertis en carte équirectangulaire puis filtrés
par `PMREMGenerator`. Aucun fichier HDR à télécharger.

La forme réagit au pointeur ; la scène s'atténue dès qu'on quitte le premier écran pour que le texte
reste lisible.

### Champ de points — `scene-field.js`

Une grille régulière (132 × 76 points) ondulant sous deux sinus croisés et une couche de bruit, avec
un creux qui suit le curseur. Atténuation radiale pour que la grille se fonde dans le noir.

### Galerie de projets — `scene-gallery.js`

Six plans texturés disposés en arc, en défilement infini au **glisser**, à la **molette**, aux
**flèches** du clavier — et clic pour ouvrir la fiche. Les plans se courbent avec la vitesse de
défilement, subissent une légère décomposition RVB, et les plans latéraux se désaturent. Le titre,
les métadonnées et la pagination HTML se synchronisent sur le plan centré.

## Dégradations gracieuses

Le site reste entièrement utilisable si :

- WebGL est indisponible ou le CDN Three.js injoignable → les scènes sont simplement absentes ;
- `prefers-reduced-motion` est activé → animations et parallaxes désactivées ;
- JavaScript est désactivé → tout le contenu HTML reste lisible, y compris la liste complète des
  projets sous la galerie.

## Dépendances externes (CDN, aucune installation)

| Ressource | Usage |
|---|---|
| Three.js r134 | Rendu 3D |
| Google Fonts — Inter Tight, Instrument Serif, JetBrains Mono | Typographie |

Aucune bibliothèque d'icônes : les flèches sont des caractères Unicode.

## Développement

```bash
npx http-server -p 8777     # puis http://localhost:8777
```

Servir le site plutôt que d'ouvrir les fichiers en `file://` : les textures de la galerie 3D sont
chargées par WebGL, ce que Chrome bloque sur le protocole `file://`. Le reste du site fonctionne
dans les deux cas.

## Licence

Code et contenu © Nathan Dardalhon.
