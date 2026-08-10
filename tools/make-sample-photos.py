"""Generate sample JPEGs with real GPS + timestamp EXIF, for testing trip
clustering on an emulator (whose photo gallery is otherwise empty).

The nine photos mirror the fixtures in packages/shared/src/clustering.test.ts,
so a correct run groups them into exactly three trips:

  Paris x3   ->  trip 1
  Rome  x2 + one photo with no GPS at all  ->  trip 2
  Tokyo x3   ->  trip 3

Usage:
    python tools/make-sample-photos.py [output_dir]

Then push them to a running emulator (see README, "Loading test photos").

Requires Pillow:  pip install Pillow
"""

import os
import sys
from datetime import datetime, timedelta

from PIL import Image, ImageDraw
from PIL.TiffImagePlugin import IFDRational

DEFAULT_OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sample-photos")


def deg_to_dms_rational(dec: float):
    """Decimal degrees -> EXIF degree/minute/second rationals."""
    dec = abs(dec)
    d = int(dec)
    minutes_float = (dec - d) * 60
    m = int(minutes_float)
    s = round((minutes_float - m) * 60 * 100)
    return (IFDRational(d, 1), IFDRational(m, 1), IFDRational(s, 100))


def make_photo(path, label, color, when: datetime, lat, lng):
    img = Image.new("RGB", (640, 480), color)
    draw = ImageDraw.Draw(img)
    draw.text((30, 30), label, fill=(255, 255, 255))
    draw.text((30, 60), when.strftime("%Y-%m-%d %H:%M"), fill=(255, 255, 255))
    draw.text((30, 90), f"{lat:.4f}, {lng:.4f}" if lat is not None else "no gps", fill=(255, 255, 255))

    exif = Image.Exif()
    stamp = when.strftime("%Y:%m:%d %H:%M:%S")
    exif[0x0132] = stamp  # DateTime (IFD0)

    exif_ifd = exif.get_ifd(0x8769)
    exif_ifd[0x9003] = stamp  # DateTimeOriginal
    exif_ifd[0x9004] = stamp  # DateTimeDigitized

    if lat is not None:
        gps = exif.get_ifd(0x8825)
        gps[1] = "N" if lat >= 0 else "S"
        gps[2] = deg_to_dms_rational(lat)
        gps[3] = "E" if lng >= 0 else "W"
        gps[4] = deg_to_dms_rational(lng)

    img.save(path, "JPEG", exif=exif, quality=90)


PARIS = (48.8566, 2.3522)
ROME = (41.9028, 12.4964)
TOKYO = (35.6762, 139.6503)

# offsets from `base`; chosen to exercise every branch of segmentPhotosIntoTrips:
# a >300km jump splits Paris->Rome, a >24h gap splits Rome->Tokyo, and the
# no-GPS photo must not force a split of its own.
PLAN = [
    ("stamped-paris-1.jpg", "Paris 1", (70, 100, 150), timedelta(0), PARIS),
    ("stamped-paris-2.jpg", "Paris 2", (80, 110, 160), timedelta(hours=3), (PARIS[0] + 0.01, PARIS[1] - 0.01)),
    ("stamped-paris-3.jpg", "Paris 3", (90, 120, 170), timedelta(days=1), PARIS),
    ("stamped-rome-1.jpg", "Rome 1", (160, 90, 60), timedelta(days=1, hours=4), ROME),
    ("stamped-rome-2.jpg", "Rome 2", (170, 100, 70), timedelta(days=1, hours=6), (ROME[0] - 0.01, ROME[1])),
    ("stamped-screenshot.jpg", "Screenshot (no GPS)", (110, 110, 110), timedelta(days=1, hours=7), None),
    ("stamped-tokyo-1.jpg", "Tokyo 1", (60, 140, 110), timedelta(days=12), TOKYO),
    ("stamped-tokyo-2.jpg", "Tokyo 2", (70, 150, 120), timedelta(days=12, hours=5), (TOKYO[0], TOKYO[1] + 0.01)),
    ("stamped-tokyo-3.jpg", "Tokyo 3", (80, 160, 130), timedelta(days=13), TOKYO),
]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUT
    os.makedirs(out, exist_ok=True)
    base = datetime.now() - timedelta(days=30)

    for name, label, color, offset, coords in PLAN:
        lat, lng = coords if coords else (None, None)
        make_photo(os.path.join(out, name), label, color, base + offset, lat, lng)

    print(f"Wrote {len(PLAN)} photos to {out}")
    print()
    print("To load them onto a running Android emulator:")
    print(f'  adb push "{out}/." /sdcard/DCIM/Camera/')
    print("  # then index each one so MediaStore can see it:")
    print("  adb shell content call --uri content://media --method scan_file \\")
    print("      --arg /sdcard/DCIM/Camera/stamped-paris-1.jpg      # ...repeat per file")
    print()
    print("NOTE: MediaStore often ignores EXIF dates for side-loaded files, leaving")
    print("DATE_TAKEN null. The app falls back to file modification time, so set that")
    print("to match if you want realistic trip dates:")
    print("  adb shell touch -t 202607101624 /sdcard/DCIM/Camera/stamped-paris-1.jpg")


if __name__ == "__main__":
    main()
