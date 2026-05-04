# Orlode — Slides

Présentations animées pour onboarding clients et démos commerciales.

## Stack

- **Slidev** — slides en Markdown avec animations natives
- **Mermaid** — diagrammes d'architecture avec flèches
- **Fraunces + JetBrains Mono** — typographie éditoriale Orlode

## Decks disponibles

| Fichier | Public | Durée |
|---|---|---|
| [firebase-connect.md](firebase-connect.md) | Onboarding client | ~5 min |

## Lancer en local (mode présentation)

```bash
cd docs/slides
npm install
npm run dev
```

Ouvre automatiquement http://localhost:3030 — flèches gauche/droite pour naviguer, `O` pour vue d'ensemble, `D` pour le mode dessin.

## Exporter

```bash
npm run build         # site statique HTML (pour héberger sur orlode.ai/docs)
npm run export        # PDF
npm run export-pptx   # PowerPoint
```

## Raccourcis pendant la présentation

| Touche | Action |
|---|---|
| `→` / `Espace` | Slide / clic suivant |
| `←` | Précédent |
| `O` | Overview (toutes les slides) |
| `D` | Mode dessin (annoter en live) |
| `F` | Plein écran |
| `G` | Aller à la slide N |

## Customiser

- **Palette** : éditer les variables CSS dans chaque `<style>` block (cream `#FFFAF0`, deep green `#0A4F3C`, gold `#D4A017`)
- **Animations** : `<v-clicks>` pour révéler les éléments un par un, `transition: slide-up` dans le frontmatter pour les transitions
- **Diagrammes** : utiliser ` ```mermaid ` (flowchart, sequence, gantt, etc.)

## Conventions de nommage

- `<feature>-connect.md` → tutoriels onboarding (Firebase, Gmail, Slack...)
- `<feature>-demo.md` → démos commerciales
- `<feature>-arch.md` → présentations architecturales internes
