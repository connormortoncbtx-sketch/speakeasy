#!/usr/bin/env python3
"""
Fetches the full cocktail catalog from TheCocktailDB and writes cocktails.json.
Run once after cloning. Re-run to refresh.

    python3 fetch_cocktails.py
"""

import json
import string
import sys
import time
from urllib.request import urlopen
from urllib.error import URLError

API_BASE = "https://www.thecocktaildb.com/api/json/v1/1"
OUTPUT = "cocktails.json"


def fetch_letter(letter):
    url = f"{API_BASE}/search.php?f={letter}"
    for attempt in range(3):
        try:
            with urlopen(url, timeout=20) as resp:
                data = json.loads(resp.read())
                return data.get("drinks") or []
        except URLError as e:
            if attempt < 2:
                time.sleep(1.5)
            else:
                print(f"  ! failed: {e}", file=sys.stderr)
                return []


def normalize(d):
    ingredients = []
    for i in range(1, 16):
        name = d.get(f"strIngredient{i}")
        measure = d.get(f"strMeasure{i}")
        if name and name.strip():
            ingredients.append({
                "name": name.strip(),
                "measure": (measure or "").strip(),
            })
    return {
        "id": d["idDrink"],
        "name": d["strDrink"],
        "category": d.get("strCategory") or "Other",
        "alcoholic": d.get("strAlcoholic") or "Unknown",
        "glass": d.get("strGlass") or "",
        "instructions": d.get("strInstructions") or "",
        "image": d.get("strDrinkThumb") or "",
        "iba": d.get("strIBA") or "",
        "tags": [t for t in (d.get("strTags") or "").split(",") if t],
        "ingredients": ingredients,
    }


def main():
    print(f"Fetching catalog from {API_BASE}...")
    seen = set()
    catalog = []

    for letter in string.ascii_lowercase:
        sys.stdout.write(f"  {letter} ... ")
        sys.stdout.flush()
        drinks = fetch_letter(letter)
        new = 0
        for d in drinks:
            if d["idDrink"] not in seen:
                seen.add(d["idDrink"])
                catalog.append(normalize(d))
                new += 1
        print(f"{new:>3} new  ({len(catalog):>4} total)")

    catalog.sort(key=lambda c: c["name"].lower())

    payload = {
        "version": 1,
        "source": "TheCocktailDB",
        "fetched_at": int(time.time()),
        "count": len(catalog),
        "cocktails": catalog,
    }

    with open(OUTPUT, "w") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Wrote {len(catalog)} cocktails to {OUTPUT}")
    print(f"  ({len(open(OUTPUT).read()) // 1024} KB)")


if __name__ == "__main__":
    main()
