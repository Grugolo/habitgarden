# Habit Garden 🌱

A calm habit tracker where good habits are plants you water, and bad habits are weeds you tame. No logins, no accounts, no push notifications. All data stays on your device (localStorage).

## Live demo setup (GitHub Pages)

1. Create a new **public** GitHub repository (e.g. `habit-garden`).
2. Upload all the files in this folder to the repo root, keeping the structure:
   ```
   index.html
   styles.css
   app.js
   manifest.json
   sw.js
   icons/icon-192.png
   icons/icon-512.png
   icons/icon-maskable-512.png
   ```
3. In the repo, go to **Settings → Pages**.
4. Under "Build and deployment", set **Source** to `Deploy from a branch`.
5. Choose branch `main` (or `master`) and folder `/ (root)`, then **Save**.
6. Wait a minute, then visit the URL GitHub shows you (something like `https://yourusername.github.io/habit-garden/`).

That's it — no build step, no dependencies to install. It's plain HTML/CSS/JS.

## Using it

- Tap **"+ Plant a new habit"** to add a good habit (grows a plant) or a bad habit (a weed you tame by resisting it).
- Tap **"Water today"** / **"Mark resisted"** once a day per habit.
- Tap a plant to see its health, streak, and 21-day history.
- Miss a day and the plant just fades a little — it doesn't reset or punish you. The goal is a gentle habit, not another addictive app.
- In winter (Dec–Feb) bad-habit "weeds" get a visual thermal cover, and a slip during that time won't hurt as much — a bit of self-compassion built into the model.

## Installing as an app

Once hosted, most browsers (Chrome, Edge, Safari on iOS via "Add to Home Screen") let you install it like a native app using the manifest and service worker included here. It'll work offline after the first visit.

## Data & privacy

Everything is stored locally in your browser's `localStorage` under the key `habitgarden:habits:v1`. Nothing is sent to any server. Clearing your browser data will reset the garden. There is no backend, no analytics, no accounts.

## Customizing

- Colors and fonts: `styles.css` (CSS variables at the top).
- Plant species / logic: `app.js` (`SPECIES` array and `computeHealth` function).
- App name/icons: `manifest.json` and the `icons/` folder.
