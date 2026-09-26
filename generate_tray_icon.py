import os
from PIL import Image, ImageDraw

def create_crisp_tray_icon():
    # macOS menu bar standard: 18x18 points (36x36 @2x)
    # Template icons use pure solid black on transparent background.
    # macOS automatically tints the black pixels to crisp white in dark menu bars / wallpaper!
    
    scale = 8 # 8x supersampling for ultra smooth anti-aliased curves
    size = 18 * scale # 144x144
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Crisp Apple Checkbox outline
    pad = int(2.2 * scale) # 18px
    box_rect = [pad, pad, size - pad, size - pad]
    border_width = int(1.6 * scale) # ~13px
    corner_radius = int(3.6 * scale) # ~29px

    draw.rounded_rectangle(
        box_rect,
        radius=corner_radius,
        outline=(0, 0, 0, 255),
        width=border_width
    )

    # Sharp Apple Checkmark inside
    # Point 1: Left start of checkmark
    # Point 2: Bottom vertex of checkmark
    # Point 3: Top right tip of checkmark
    p1 = (int(5.2 * scale), int(9.0 * scale))
    p2 = (int(7.6 * scale), int(12.0 * scale))
    p3 = (int(12.8 * scale), int(6.0 * scale))

    check_width = int(1.8 * scale)

    draw.line([p1, p2], fill=(0, 0, 0, 255), width=check_width)
    draw.line([p2, p3], fill=(0, 0, 0, 255), width=check_width)

    # Rounded end caps for checkmark
    r_cap = check_width / 2.0
    for p in [p1, p2, p3]:
        draw.ellipse([p[0] - r_cap, p[1] - r_cap, p[0] + r_cap, p[1] + r_cap], fill=(0, 0, 0, 255))

    # Downscale with high quality Lanczos resampling
    img_1x = img.resize((18, 18), Image.Resampling.LANCZOS)
    img_2x = img.resize((36, 36), Image.Resampling.LANCZOS)

    img_1x.save("trayTemplate.png", "PNG")
    img_2x.save("trayTemplate@2x.png", "PNG")
    print("Successfully generated transparent monochrome Apple Menu Bar tray icons!")

if __name__ == "__main__":
    create_crisp_tray_icon()
