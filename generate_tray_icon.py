import os
from PIL import Image, ImageDraw

def create_tray_template():
    # 4x supersampling (72x72 downscaled to 18x18 and 36x36)
    scale = 4
    size = 18 * scale  # 72x72
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Clean Apple Checkbox Outline (Rounded Rect)
    stroke = int(1.8 * scale) # ~7px
    pad = int(2.5 * scale)     # 10px
    radius = int(3.5 * scale)  # 14px

    # Outer rounded rectangle
    draw.rounded_rectangle(
        [pad, pad, size - pad, size - pad],
        radius=radius,
        outline=(255, 255, 255, 255),
        width=stroke
    )

    # Crisp Apple Checkmark inside
    p1 = (int(5.2 * scale), int(9.2 * scale))
    p2 = (int(7.8 * scale), int(12.2 * scale))
    p3 = (int(13.2 * scale), int(6.0 * scale))

    check_stroke = int(1.9 * scale)
    draw.line([p1, p2], fill=(255, 255, 255, 255), width=check_stroke)
    draw.line([p2, p3], fill=(255, 255, 255, 255), width=check_stroke)

    # Smooth caps
    r_cap = check_stroke / 2
    for p in [p1, p2, p3]:
        draw.ellipse([p[0] - r_cap, p[1] - r_cap, p[0] + r_cap, p[1] + r_cap], fill=(255, 255, 255, 255))

    # Downscale using high quality Lanczos filter
    img_2x = img.resize((36, 36), Image.Resampling.LANCZOS)
    img_1x = img.resize((18, 18), Image.Resampling.LANCZOS)

    img_1x.save("trayTemplate.png", "PNG")
    img_2x.save("trayTemplate@2x.png", "PNG")
    print("Generated pixel-perfect trayTemplate.png and trayTemplate@2x.png")

if __name__ == "__main__":
    create_tray_template()
