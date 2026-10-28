# ISR-auto

Calcul automatique de l'impôt sur le revenu (usage personnel, non officiel).
Application web installable (PWA) : aucune étape de build, uniquement des fichiers statiques.

## Publier depuis un téléphone
1. GitHub : créer un dépôt, puis « Add file » → « Upload files » et envoyer **tous les fichiers à la racine** (pas de dossier).
2. Vercel : « Add New » → « Project » → choisir le dépôt. Framework Preset : **Other**. Laisser vide Build Command et Output Directory. « Deploy ».
3. Ouvrir l'adresse Vercel sur le téléphone, puis « Installer l'application » (Android) ou Partager → « Sur l'écran d'accueil » (iPhone).

## Fichiers
index.html, style.css, engine.js (calculs), app.js (interface), manifest.webmanifest, sw.js (hors ligne),
favicon.svg, favicon.ico, icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png, vercel.json.

Pour changer le barème plus tard : modifier le bloc `BAREMES` au début de `engine.js`
(et, si les fichiers changent, le numéro `CACHE` dans `sw.js` pour forcer la mise à jour hors ligne).
