import os
from PIL import Image, ImageDraw

def create_tray_template():
    # 4x supersampling for ultra smooth antialiasing
    scale = 4
    size = 18 * scale  # 72x72
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Let's draw a clean, crisp Apple Reminders circle with checkmark
    # Outer circle: center (36, 36), radius 28
    cx, cy = size / 2, size / 2
    r = 27
    stroke_w = int(2.2 * scale)

    # Draw smooth circle outline
    bbox = [cx - r, cy - r, cx + r, cy + r]
    draw.ellipse(bbox, outline=(255, 255, 255, 255), width=stroke_w)

    # Draw checkmark inside circle
    # Points for checkmark: left, bottom inflection, right top
    p1 = (cx - 11 * scale, cy + 0.5 * scale)
    p2 = (cx - 3.5 * scale, cy + 8 * scale)
    p3 = (cx + 11.5 * scale, cy - 7 * scale)

    check_w = int(2.4 * scale)
    draw.line([p1, p2], fill=(255, 255, 255, 255), width=check_w, joint="round")
    draw.line([p2, p3], fill=(255, 255, 255, 255), width=check_w, joint="round")

    # Round caps for checkmark ends
    r_cap = check_w / 2
    for p in [p1, p2, p3]:
        draw.ellipse([p[0]-r_cap, p[1]-r_cap, p[0]+r_cap, p[1]+r_cap], fill=(255, 255, 255, 255))

    # Downscale to 36x36 (@2x) and 18x18 (@1x)
    img_2x = img.resize((36, 36), Image.Resampling.LANCZOS)
    img_1x = img.resize((18, 18), Image.Resampling.LANCZOS)

    img_1x.save("trayTemplate.png", "PNG")
    img_2x.save("trayTemplate@2x.png", "PNG")
    print("Created trayTemplate.png and trayTemplate@2x.png")

if __name__ == "__main__":
    create_tray_template()
