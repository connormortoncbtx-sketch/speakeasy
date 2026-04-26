# The Bar 🥃

A personal cocktail catalog PWA. Tracks your shelf, tells you what you can pour, and lets you build your own recipe book. Deployable to GitHub Pages, installable to your iOS home screen.

## What's in here

```
the-bar/
├── index.html              # PWA shell
├── app.jsx                 # React app (Babel compiles in browser)
├── style.css               # Speakeasy-themed stylesheet
├── manifest.webmanifest    # PWA manifest
├── sw.js                   # Service worker (offline cache)
├── cocktails.json          # Catalog (run fetch_cocktails.py to populate)
├── custom-cocktails.json   # Curated featured drinks (commit your favs)
├── substitutions.json      # Brand→generic + substitution maps
├── fetch_cocktails.py      # One-time scraper for TheCocktailDB
└── icons/                  # PWA icons
```

## First-time setup

```bash
# 1. Get the catalog (one-time, ~5 sec)
python3 fetch_cocktails.py

# 2. Push to a fresh repo
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin git@github.com:<you>/the-bar.git
git push -u origin main

# 3. In GitHub: Settings → Pages → Source = "Deploy from branch" → main / root
```

GitHub will give you a URL like `https://<you>.github.io/the-bar/`. Open it in iOS Safari → Share → **Add to Home Screen**. Done.

## Updating the catalog

```bash
python3 fetch_cocktails.py
git add cocktails.json
git commit -m "refresh catalog"
git push
```

The service worker uses stale-while-revalidate for `cocktails.json`, so the app updates in the background without breaking offline use.

## Adding featured drinks

Two channels:

**Personal (your device only).** Tap **Add Recipe** in the header → fill in the form → **Save**. Stored in localStorage. Marked `★` in the catalog.

**Featured (committed to repo).** In the form, tap **Export JSON** instead of Save. The recipe is copied to your clipboard. Paste it as a new entry into `custom-cocktails.json`'s `cocktails` array, commit, and push. Now everyone on every device sees it.

```jsonc
// custom-cocktails.json
{
  "version": 1,
  "cocktails": [
    {
      "id": "custom-1714098432000",
      "name": "Big Tex's Smoked Old Fashioned",
      "category": "Cocktail",
      "alcoholic": "Alcoholic",
      "glass": "Old-fashioned glass",
      "instructions": "Add bourbon, demerara, bitters to a mixing glass...",
      "image": "https://...",
      "iba": "",
      "tags": ["smoky", "stirred"],
      "ingredients": [
        { "name": "Bourbon", "measure": "2 oz" },
        { "name": "Demerara Syrup", "measure": "1/4 oz" },
        { "name": "Angostura Bitters", "measure": "3 dashes" }
      ],
      "custom": true,
      "source": "custom-file"
    }
  ]
}
```

## Substitution maps (`substitutions.json`)

Two-tier system, both edit-friendly.

**`brandToGeneric`** — applied at load time. Brand names anywhere (recipes or your inventory) get rewritten to a canonical generic name. Add entries when TheCocktailDB stores something brand-specific:

```json
"brandToGeneric": {
  "Bulleit": "Bourbon",
  "Patron": "Tequila",
  "Captain Morgan": "Spiced Rum"
}
```

**`substitutions`** — applied at match time. If a recipe needs X and you have Y where Y is in `substitutions[X]`, the cocktail counts as makeable and shows a `SUB` badge with a "using {alt}" note in the build list. Asymmetric where appropriate (you can sub bourbon for rye in many drinks but not vice versa for, say, a Sazerac):

```json
"substitutions": {
  "Rye Whiskey": ["Bourbon", "Whiskey"],
  "Cointreau":   ["Triple Sec", "Grand Marnier"]
}
```

After editing, reload the app — the SW will pick up the new file on next fetch.

## How it works

- **Build:** None. Babel standalone compiles JSX in the browser. Caches after first load. No npm, no Node, no Vite.
- **Data:** All JSON files are static, served by GitHub Pages. App reads them once on mount via `fetch()`.
- **Persistence:** Inventory + your local recipes are in `localStorage`. Wiping the site data resets them.
- **Offline:** Service worker caches the shell on install. Stale-while-revalidate for the JSON files. Works offline indefinitely after first load.
- **Matching:** Each ingredient gets one of three statuses:
  - `have` (you've got it canonically)
  - `sub` (you've got an acceptable substitute — recipe still counts as makeable, flagged in UI)
  - `miss` (no match)
  - A cocktail is "makeable" if `missing.length === 0`. "One or two bottles away" if `missing.length <= 2`.

## Dev notes

The `_comment` keys inside `substitutions.json` are stripped by the app at load time, so feel free to leave notes in there.

If you fork or modify the React app, you don't need a build step — just edit `app.jsx` and push. Babel handles the rest in the browser. The downside is ~200KB of Babel script on first load (cached forever after that). If you ever want to ditch the runtime compile, you can pre-build with esbuild and replace the `<script type="text/babel">` with `<script src="./app.js">`.

## Future toys

- Variations (split-base, smoked, fat-washed riffs as forks of base recipes)
- Build cost / spec preview
- Tasting notes / personal ratings
- Smart subs (auto-suggest "if you had X you could also make Y, Z, …")
