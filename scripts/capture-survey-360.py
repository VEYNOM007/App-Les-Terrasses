#!/usr/bin/env python3
"""Captures 360x640 du questionnaire /avis (Playwright Python).

Produit deux captures qui prouvent les correctifs :
  1. ecran des atouts : la note "champs facultatifs" n'est plus affichee
     (elle n'apparait que sur les ecrans qui ont des champs facultatifs)
     et le bas de page n'est plus coupe par la barre d'action ;
  2. Q9 (freins) avec "Autre chose" coche : le champ "Precisez" est visible.

Usage :
    python scripts/capture-survey-360.py --base-url http://127.0.0.1:3005 \
        --out-dir captures-fix-360x640
"""

import argparse
import re
import sys
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

DEFAULT_BASE_URL = "http://127.0.0.1:3005"
VIEWPORT = {"width": 360, "height": 640}

ATOUTS_TITLE = "Ce que prévoit le projet"
BLOCKERS_TITLE = "freinerait"


def _goto_form(page: Page, base_url: str) -> None:
    page.goto(base_url + "/avis", wait_until="domcontentloaded", timeout=60000)
    page.get_by_role("button", name=re.compile("Commencer")).click(timeout=15000)
    page.wait_for_timeout(500)


def _title(page: Page) -> str:
    return page.locator("h1").first.inner_text().strip()


def _fill_required(page: Page) -> None:
    """Coche la premiere option d'un ecran a choix (radio/checkbox)."""
    radios = page.locator("input[type=radio]")
    checks = page.locator("input[type=checkbox]")
    if radios.count() > 0:
        radios.first.check(force=True)
    elif checks.count() > 0:
        checks.first.check(force=True)


def _next(page: Page) -> None:
    page.get_by_role("button", name=re.compile("^Suivant")).click(timeout=15000)
    page.wait_for_timeout(300)


def _advance_until(page: Page, base_url: str, needle: str, max_steps: int = 30) -> None:
    _goto_form(page, base_url)
    for _ in range(max_steps):
        if needle in _title(page):
            return
        _fill_required(page)
        _next(page)
    raise RuntimeError(f"ecran introuvable apres {max_steps} etapes : {needle}")


def capture_atouts(page: Page, base_url: str, out_dir: Path) -> Path:
    _advance_until(page, base_url, ATOUTS_TITLE)
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(600)
    target = out_dir / "01-atouts-360x640-note-absente-bas-non-coupe.png"
    page.screenshot(path=str(target))
    return target


def capture_blockers_autre(page: Page, base_url: str, out_dir: Path) -> Path:
    _advance_until(page, base_url, BLOCKERS_TITLE)

    labels = page.locator("label")
    clicked = False
    for index in range(labels.count()):
        if "Autre chose" in labels.nth(index).inner_text():
            labels.nth(index).click()
            clicked = True
            break
    if not clicked:
        raise RuntimeError("option 'Autre chose' introuvable sur l'ecran des freins")

    field = page.locator("#other-freins")
    field.wait_for(state="visible", timeout=10000)
    field.fill("Financement trop lourd")

    # Aller au bas de l'ecran : la note facultative doit etre entierement
    # visible au-dessus de la barre d'action (jamais coupee).
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(500)

    box = field.bounding_box()
    viewport = page.viewport_size
    if box is None or viewport is None or box["y"] + box["height"] > viewport["height"]:
        raise RuntimeError("le champ Precisez n'est pas visible dans le viewport 360x640")

    target = out_dir / "02-q9-autre-precisez-360x640.png"
    page.screenshot(path=str(target))
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description="Captures 360x640 du questionnaire /avis")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="URL du serveur local")
    parser.add_argument(
        "--out-dir",
        default="captures-fix-360x640",
        help="Dossier de sortie des captures",
    )
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        context = browser.new_context(
            viewport=VIEWPORT,
            device_scale_factor=1,
            is_mobile=True,
            has_touch=True,
            locale="fr-FR",
        )
        page = context.new_page()
        first = capture_atouts(page, base_url, out_dir)
        second = capture_blockers_autre(page, base_url, out_dir)
        browser.close()

    print(f"OK {first}")
    print(f"OK {second}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
