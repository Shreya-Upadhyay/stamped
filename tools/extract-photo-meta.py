"""Dump GPS + capture time from a folder of photos, for clustering tuning.

The app reads this metadata on-device via expo-media-library. Tuning the
grouping thresholds against a real library through the app UI is painfully
slow, so this pulls the same three fields — lat, lng, capturedAt — straight
out of the files into JSON that the shared clustering can be run over
directly.

    python tools/extract-photo-meta.py "C:/path/to/photos"

Writes packages/shared/fixtures/photos.json by default. That file is
gitignored: it is a map of where you have been, and it does not belong in a
repository.

HEIC (what modern iPhones shoot) needs `pip install pillow-heif`. Without it
those files are counted and skipped rather than silently dropped.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

from PIL import ExifTags, Image

try:  # Optional: iPhone photos are HEIC and Pillow alone can't open them.
    import pillow_heif

    pillow_heif.register_heif_opener()
    HEIC_SUPPORTED = True
except ImportError:
    HEIC_SUPPORTED = False

EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".heic", ".heif"}
HEIC_EXTENSIONS = {".heic", ".heif"}

# EXIF tags, by number, so we don't depend on Pillow's name tables.
DATETIME_ORIGINAL = 36867
DATETIME_DIGITIZED = 36868
DATETIME = 306


def _to_degrees(value) -> float | None:
    """EXIF stores coordinates as (degrees, minutes, seconds) rationals."""
    try:
        degrees, minutes, seconds = (float(v) for v in value)
    except (TypeError, ValueError):
        return None
    return degrees + minutes / 60 + seconds / 3600


def _parse_exif_datetime(value) -> int | None:
    """EXIF datetimes are 'YYYY:MM:DD HH:MM:SS' with no timezone.

    Treated as local time, which is what the camera meant — and matches how
    the app parses them (see parseExifDate in photo-gps.tsx).
    """
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.strptime(value.strip()[:19], "%Y:%m:%d %H:%M:%S")
    except ValueError:
        return None
    return int(parsed.timestamp() * 1000)


def read_meta(path: Path) -> dict | None:
    """One photo's lat/lng/capturedAt, or None if the file can't be read."""
    try:
        with Image.open(path) as image:
            exif = image.getexif()
            gps = exif.get_ifd(ExifTags.IFD.GPSInfo)
            sub = exif.get_ifd(ExifTags.IFD.Exif)
    except Exception:
        return None

    lat = lng = None
    if gps:
        tagged = {ExifTags.GPSTAGS.get(k, k): v for k, v in gps.items()}
        lat = _to_degrees(tagged.get("GPSLatitude"))
        lng = _to_degrees(tagged.get("GPSLongitude"))
        if lat is not None and tagged.get("GPSLatitudeRef") == "S":
            lat = -lat
        if lng is not None and tagged.get("GPSLongitudeRef") == "W":
            lng = -lng

    captured_at = None
    for tag in (DATETIME_ORIGINAL, DATETIME_DIGITIZED):
        captured_at = _parse_exif_datetime(sub.get(tag))
        if captured_at is not None:
            break
    if captured_at is None:
        captured_at = _parse_exif_datetime(exif.get(DATETIME))
    if captured_at is None:
        # Fall back to the file's own mtime, as the app falls back to the
        # media store's modification time. Better than dropping the photo.
        captured_at = int(path.stat().st_mtime * 1000)

    has_gps = lat is not None and lng is not None
    return {
        "id": path.name,
        "filename": path.name,
        "lat": lat if has_gps else None,
        "lng": lng if has_gps else None,
        "hasGps": has_gps,
        "capturedAt": captured_at,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", help="Folder of photos (searched recursively)")
    parser.add_argument(
        "-o",
        "--out",
        default=str(Path("packages/shared/fixtures/photos.json")),
        help="Where to write the JSON",
    )
    args = parser.parse_args()

    root = Path(args.folder)
    if not root.is_dir():
        print(f"Not a folder: {root}", file=sys.stderr)
        return 1

    photos: list[dict] = []
    skipped_heic = 0
    unreadable = 0
    scanned = 0

    for dirpath, _dirnames, filenames in os.walk(root):
        for name in sorted(filenames):
            suffix = Path(name).suffix.lower()
            if suffix not in EXTENSIONS:
                continue
            scanned += 1
            if suffix in HEIC_EXTENSIONS and not HEIC_SUPPORTED:
                skipped_heic += 1
                continue
            meta = read_meta(Path(dirpath) / name)
            if meta is None:
                unreadable += 1
                continue
            photos.append(meta)

    photos.sort(key=lambda p: p["capturedAt"])

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(photos, indent=2), encoding="utf-8")

    with_gps = sum(1 for p in photos if p["hasGps"])
    print(f"Scanned   {scanned} image files under {root}")
    print(f"Extracted {len(photos)}  ({with_gps} with GPS, {len(photos) - with_gps} without)")
    if skipped_heic:
        print(f"Skipped   {skipped_heic} HEIC files — run: pip install pillow-heif")
    if unreadable:
        print(f"Unreadable {unreadable} files")
    print(f"Wrote     {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
