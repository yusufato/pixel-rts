import os
import sys

def main():
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("Pillow kutuphanesi eksik, kuruluyor...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow"])
        from PIL import Image, ImageDraw

    BLACK = (20, 20, 20, 255)
    WHITE = (245, 245, 245, 255)
    BLUE = (64, 96, 220, 255)
    RED = (220, 40, 40, 255)
    GRAY = (80, 80, 80, 255)

    UNITS = [
        "INFANTRY", "MECH_INFANTRY", "ARMOR_INFANTRY", 
        "RECON", "ENGINEER", "MEDIC", 
        "ARMOR", "ANTI_TANK", "ARTILLERY"
    ]

    base_w, base_h = 15, 11
    # Scale x20 gives 300x220 per icon. Very high clarity pixel-art.
    scale = 20 

    def draw_unit(unit_type, is_red):
        bg = RED if is_red else BLUE
        img = Image.new("RGBA", (base_w, base_h), bg)
        draw = ImageDraw.Draw(img)

        # Border
        draw.line([0, 0, base_w-1, 0], fill=BLACK) # top
        draw.line([0, base_h-1, base_w-1, base_h-1], fill=BLACK) # bot
        draw.line([0, 0, 0, base_h-1], fill=BLACK) # left
        draw.line([base_w-1, 0, base_w-1, base_h-1], fill=BLACK) # right

        def draw_rounded_rect(x0, y0, x1, y1, color, fill=False):
            draw.line([x0+1, y0, x1-1, y0], fill=color)
            draw.line([x0+1, y1, x1-1, y1], fill=color)
            draw.line([x0, y0+1, x0, y1-1], fill=color)
            draw.line([x1, y0+1, x1, y1-1], fill=color)
            if fill:
                for y in range(y0+1, y1):
                    draw.line([x0+1, y, x1-1, y], fill=color)

        if unit_type == "INFANTRY":
            draw.line([2, 2, 12, 8], fill=WHITE)
            draw.line([2, 8, 12, 2], fill=WHITE)
            
        elif unit_type == "MECH_INFANTRY":
            draw.line([2, 1, 2, 9], fill=GRAY) 
            draw.line([4, 2, 12, 8], fill=WHITE)
            draw.line([4, 8, 12, 2], fill=WHITE)
            
        elif unit_type == "ARMOR_INFANTRY":
            draw_rounded_rect(3, 3, 11, 7, GRAY)
            draw.line([2, 2, 12, 8], fill=WHITE)
            draw.line([2, 8, 12, 2], fill=WHITE)
            
        elif unit_type == "RECON":
            draw.line([2, 8, 12, 2], fill=WHITE)
            
        elif unit_type == "ENGINEER":
            draw.line([4, 4, 10, 4], fill=WHITE)
            draw.line([4, 4, 4, 7], fill=WHITE)
            draw.line([7, 4, 7, 7], fill=WHITE)
            draw.line([10, 4, 10, 7], fill=WHITE)
            
        elif unit_type == "MEDIC":
            draw.line([7, 1, 7, 9], fill=WHITE)
            draw.line([1, 5, 13, 5], fill=WHITE)
            
        elif unit_type == "ARMOR":
            draw_rounded_rect(3, 3, 11, 7, GRAY)
            
        elif unit_type == "ANTI_TANK":
            draw_rounded_rect(3, 3, 11, 7, GRAY)
            draw.line([4, 7, 7, 3], fill=WHITE)
            draw.line([7, 3, 10, 7], fill=WHITE)
            
        elif unit_type == "ARTILLERY":
            draw_rounded_rect(5, 3, 9, 7, GRAY, fill=True)

        return img.resize((base_w * scale, base_h * scale), Image.NEAREST)

    cols = len(UNITS)
    rows = 2
    padding = 30
    
    icon_w = base_w * scale
    icon_h = base_h * scale

    sheet_w = cols * icon_w + (cols + 1) * padding
    sheet_h = rows * icon_h + (rows + 1) * padding

    sheet = Image.new("RGBA", (sheet_w, sheet_h), (0,0,0,0))

    for col, unit in enumerate(UNITS):
        img_blue = draw_unit(unit, False)
        x = padding + col * (icon_w + padding)
        y = padding
        sheet.paste(img_blue, (x, y))

        img_red = draw_unit(unit, True)
        y2 = padding * 2 + icon_h
        sheet.paste(img_red, (x, y2))

    out_path = os.path.join(os.path.dirname(__file__), "icons.png")
    sheet.save(out_path)
    print(f"Ikonlar basariyla olusturuldu: {out_path}")

if __name__ == '__main__':
    main()
