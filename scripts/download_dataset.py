# -*- coding: utf-8 -*-
"""
download_dataset.py  (v3 - ASCII safe for Windows)
Downloads ~750 LFW face images using requests with multiple mirrors.
Run: python scripts/download_dataset.py
"""

import io
import os
import shutil
import tarfile
from pathlib import Path

import requests

# ── Config ────────────────────────────────────────────────
MIRRORS = [
    "https://ndownloader.figshare.com/files/5976018",
    "https://raw.githubusercontent.com/jbrownlee/Datasets/master/lfw-funneled.tgz",
    "http://vis-www.cs.umass.edu/lfw/lfw.tgz",
]
TGZ_PATH       = Path("dataset/lfw.tgz")
EXTRACT_TO     = Path("dataset/lfw_raw")
SUBSET_DIR     = Path("dataset/lfw_subset")
TARGET_IMAGES  = 750
MIN_PER_PERSON = 10
# ─────────────────────────────────────────────────────────


def download_with_requests(url, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    print("  Trying: " + url)
    with requests.get(url, stream=True, timeout=120,
                      headers={"User-Agent": "Mozilla/5.0"}) as r:
        r.raise_for_status()
        total      = int(r.headers.get("content-length", 0))
        downloaded = 0
        with open(str(dest), "wb") as f:
            for chunk in r.iter_content(chunk_size=512 * 1024):
                f.write(chunk)
                downloaded += len(chunk)
                if total:
                    pct = min(100, downloaded * 100 // total)
                    mb  = downloaded / 1024 / 1024
                    # ASCII-only progress bar
                    bar = "#" * (pct // 2) + "-" * (50 - pct // 2)
                    print("\r  [%s] %d%%  (%.1f MB)" % (bar, pct, mb),
                          end="", flush=True)
    print("")
    print("  Download complete!")


def try_all_mirrors():
    for url in MIRRORS:
        try:
            download_with_requests(url, TGZ_PATH)
            return True
        except Exception as e:
            print("  FAILED: " + str(e))
            if TGZ_PATH.exists():
                TGZ_PATH.unlink()
    return False


def extract():
    print("\nExtracting to " + str(EXTRACT_TO) + " ...")
    EXTRACT_TO.mkdir(parents=True, exist_ok=True)
    with tarfile.open(str(TGZ_PATH), "r:gz") as tar:
        tar.extractall(str(EXTRACT_TO))
    print("  Extraction complete!")


def pick_subset():
    candidates = [p for p in EXTRACT_TO.iterdir() if p.is_dir()]
    lfw_root   = candidates[0] if candidates else EXTRACT_TO

    SUBSET_DIR.mkdir(parents=True, exist_ok=True)

    people = []
    for d in sorted(lfw_root.iterdir()):
        if not d.is_dir():
            continue
        imgs = sorted(d.glob("*.jpg"))
        if len(imgs) >= MIN_PER_PERSON:
            people.append((d.name, imgs))

    print("\n  Found %d people with >= %d images." % (len(people), MIN_PER_PERSON))

    total, n_people = 0, 0
    for name, imgs in people:
        if total >= TARGET_IMAGES:
            break
        dest = SUBSET_DIR / name
        dest.mkdir(exist_ok=True)
        for img in imgs:
            if total >= TARGET_IMAGES:
                break
            shutil.copy2(str(img), str(dest / img.name))
            total += 1
        n_people += 1

    print("  Copied %d images from %d identities -> %s" % (total, n_people, str(SUBSET_DIR)))
    return total, n_people


def main():
    print("=" * 55)
    print("  LFW Dataset Downloader")
    print("=" * 55)

    # Download
    if TGZ_PATH.exists() and TGZ_PATH.stat().st_size > 1_000_000:
        print("Archive already exists at " + str(TGZ_PATH) + ", skipping.")
    else:
        print("\nDownloading LFW dataset (~170 MB)...")
        if not try_all_mirrors():
            print("\nERROR: All mirrors failed. Check your internet connection.")
            raise SystemExit(1)

    # Extract
    if EXTRACT_TO.exists() and any(EXTRACT_TO.iterdir()):
        print("Already extracted at " + str(EXTRACT_TO) + ", skipping.")
    else:
        extract()

    # Subset
    if SUBSET_DIR.exists():
        existing = sum(1 for _ in SUBSET_DIR.rglob("*.jpg"))
        if existing >= TARGET_IMAGES:
            print("Subset ready: %d images in %s" % (existing, str(SUBSET_DIR)))
            print("\nDone! Now run:\n   python scripts/seed_database.py")
            return

    total, n_people = pick_subset()
    print("\nDataset Summary:")
    print("   Images     : %d" % total)
    print("   Identities : %d" % n_people)
    print("   Location   : " + str(SUBSET_DIR.resolve()))
    print("\nDone! Now run:\n   python scripts/seed_database.py")


if __name__ == "__main__":
    main()
