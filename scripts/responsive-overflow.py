#!/usr/bin/env python3
"""Test de non-régression responsivité : scrollWidth == innerWidth.

Vérifie qu'aucune page publique de l'app ne déborde horizontalement,
sur plusieurs viewports, contre un SERVEUR LOCAL (build de prod local).

Usage:
    python scripts/responsive-overflow.py [--base-url http://localhost:3000]

Pages couvertes (celles où le bug Navbar a été mesuré en prod <=360px) :
    /catalogue, /, /suivi, /login
Viewports couverts : 320, 360, 390, 414.

Sort : exit code 0 si toutes les combinaisons passent, sinon exit code 1
et la liste des échecs (avec l'élément coupable en débordement).
"""

import argparse
import sys

from playwright.sync_api import sync_playwright

DEFAULT_BASE_URL = "http://127.0.0.1:3000"
PAGES = ["/catalogue", "/", "/suivi", "/login"]
VIEWPORTS = [320, 360, 390, 414]
# Tolérance d'arrondi du moteur de rendu.
TOLERANCE = 1

JS_SCAN = """
() => {
  const iw = window.innerWidth;
  const docW = document.documentElement.scrollWidth;
  if (!(docW > iw + 1)) {
    return { innerW: iw, scrollW: docW, hasOverflow: false, offenders: [] };
  }
  const offenders = [];
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.right > iw + 1 || r.left < -1) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || '').trim().slice(0, 40),
        cls: (typeof el.className === 'string') ? el.className.slice(0, 100) : String(el.className),
        left: Math.round(r.left),
        right: Math.round(r.right),
        w: Math.round(r.width),
      });
    }
  });
  const seen = new Set();
  const uniq = [];
  for (const o of offenders) {
    const k = o.tag + '|' + o.cls;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(o);
  }
  return { innerW: iw, scrollW: docW, hasOverflow: true, offenders: uniq.slice(0, 20) };
}
"""


def _safe(s: str) -> str:
    return s.encode("ascii", "backslashreplace").decode("ascii")


def main() -> int:
    parser = argparse.ArgumentParser(description="Test de non-régression responsivité")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="URL du serveur local")
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    failures = []
    total = 0
    passed = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        page = browser.new_page()
        for page_path in PAGES:
            for wp in VIEWPORTS:
                total += 1
                page.set_viewport_size({"width": wp, "height": 844})
                page.goto(base_url + page_path, wait_until="networkidle", timeout=45000)
                page.wait_for_timeout(1800)
                r = page.evaluate(JS_SCAN)
                if r["hasOverflow"]:
                    failures.append({
                        "page": page_path,
                        "viewport": wp,
                        "innerW": r["innerW"],
                        "scrollW": r["scrollW"],
                        "offenders": r["offenders"][:10],
                    })
                else:
                    passed += 1
                print(f"{page_path:>10} @ {wp:>3}px -> scrollW={r['scrollW']} innerW={r['innerW']} "
                      f"{'FAIL' if r['hasOverflow'] else 'ok'}")
        browser.close()

    print(f"\n{passed}/{total} combinaisons OK")
    if failures:
        print(f"\nECHEC : {len(failures)} combinaison(s) en debit horizontal :")
        for f in failures:
            print(f"  - {f['page']} @ {f['viewport']}px (scrollW={f['scrollW']} innerW={f['innerW']})")
            for o in f["offenders"]:
                print(f"       <{o['tag']}> left={o['left']} right={o['right']} w={o['w']} "
                      f"text={_safe(o['text'])} cls={_safe(o['cls'])}")
        return 1
    print("OK : aucune page ne deborde horizontalement.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
