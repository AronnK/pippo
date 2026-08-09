from pathlib import Path
from PIL import Image
import os

SOURCE = Path("assets/pippo")
OUTPUT = Path("assets/pippo-optimized")

# Keep originals untouched.
OUTPUT.mkdir(parents=True, exist_ok=True)

# Character images are displayed relatively large,
# so keep enough resolution for phones/tablets.
MAX_WIDTH = 1000

# WebP quality. 85 is a good balance for illustrations.
QUALITY = 85

png_files = sorted(SOURCE.glob("*.png"))

if not png_files:
    print("No PNG files found in", SOURCE)
    raise SystemExit(1)

total_before = 0
total_after = 0

print()
print("PIPPO IMAGE OPTIMIZATION")
print("=" * 70)

for source in png_files:
    output = OUTPUT / f"{source.stem}.webp"

    before = source.stat().st_size
    total_before += before

    with Image.open(source) as image:
        image = image.convert("RGBA")

        original_width, original_height = image.size

        # Preserve aspect ratio.
        if original_width > MAX_WIDTH:
            new_height = round(original_height * MAX_WIDTH / original_width)
            image = image.resize(
                (MAX_WIDTH, new_height),
                Image.Resampling.LANCZOS
            )

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
        f"{original_width}x{original_height} -> "
        f"{Image.open(output).size[0]}x{Image.open(output).size[1]}   "
        f"{before / 1024 / 1024:6.2f} MB -> "
        f"{after / 1024 / 1024:6.2f} MB   "
        f"(-{reduction:.1f}%)"
    )

print("=" * 70)

print(
    f"TOTAL: "
    f"{total_before / 1024 / 1024:.2f} MB -> "
    f"{total_after / 1024 / 1024:.2f} MB"
)

print(
    f"REDUCTION: "
    f"{(1 - total_after / total_before) * 100:.1f}%"
)

print()
print("Optimized images were written to:")
print(OUTPUT)
print()
print("ORIGINALS WERE NOT MODIFIED.")
