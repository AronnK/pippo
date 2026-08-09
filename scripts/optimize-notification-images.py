from pathlib import Path
from PIL import Image

SOURCE = Path("assets/pippo")
OUTPUT = Path("assets/pippo-optimized")

OUTPUT.mkdir(parents=True, exist_ok=True)

QUALITY = 88

total_before = 0
total_after = 0

print()
print("# PIPPO NOTIFICATION IMAGE OPTIMIZATION")
print("=" * 80)

files = sorted(
    [
        *SOURCE.glob("*.jpg"),
        *SOURCE.glob("*.jpeg"),
    ]
)

if not files:
    print("No JPG/JPEG files found.")
    raise SystemExit(0)

for source in files:
    before = source.stat().st_size
    total_before += before

    with Image.open(source) as image:
        original_size = image.size

        # Notification images don't need resizing.
        # Preserve their original dimensions and visual quality.
        if image.mode in ("RGBA", "LA"):
            image = image.convert("RGBA")
        else:
            image = image.convert("RGB")

        output = OUTPUT / f"{source.stem}.webp"

        image.save(
            output,
            "WEBP",
            quality=QUALITY,
            method=6
        )

    after = output.stat().st_size
    total_after += after

    reduction = (1 - after / before) * 100

    print(
        f"{source.name:25} "
        f"{original_size[0]}x{original_size[1]} -> "
        f"{image.size[0]}x{image.size[1]}   "
        f"{before / 1024:8.1f} KB -> "
        f"{after / 1024:8.1f} KB   "
        f"(-{reduction:.1f}%)"
    )

print("=" * 80)

print(
    f"TOTAL: "
    f"{total_before / 1024 / 1024:.3f} MB -> "
    f"{total_after / 1024 / 1024:.3f} MB"
)

if total_before:
    print(
        f"REDUCTION: "
        f"{(1 - total_after / total_before) * 100:.1f}%"
    )

print()
print("Optimized notification images:")
print(OUTPUT)
print()
print("ORIGINALS WERE NOT MODIFIED.")
