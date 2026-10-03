import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = ROOT / "assets" / "img"
TMP_HTML = ROOT / "tools" / "temp_logo.html"
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

items = [
    {
        "name": "logo-mark.png",
        "svg": (IMG_DIR / "logo-mark.svg").read_text(encoding="utf-8"),
        "width": 1200,
        "height": 1200,
        "css_size": "width: 1000px; height: 1000px;"
    },
    {
        "name": "logo-text.png",
        "svg": (IMG_DIR / "logo-text.svg").read_text(encoding="utf-8"),
        "width": 2400,
        "height": 800,
        "css_size": "width: 2000px; height: auto;"
    },
    {
        "name": "logo-full.png",
        "svg": (IMG_DIR / "logo-full.svg").read_text(encoding="utf-8"),
        "width": 2600,
        "height": 700,
        "css_size": "width: 2200px; height: auto;"
    }
]

for item in items:
    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @font-face {{
    font-family: 'Great Vibes';
    src: url('../assets/fonts/great-vibes.woff2') format('woff2');
  }}
  @font-face {{
    font-family: 'Montserrat';
    src: url('../assets/fonts/montserrat-var.woff2') format('woff2-variations');
    font-weight: 700;
  }}
  body {{
    margin: 0;
    padding: 0;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    width: {item['width']}px;
    height: {item['height']}px;
  }}
  svg {{
    {item['css_size']}
    display: block;
  }}
</style>
</head>
<body>
{item['svg']}
</body>
</html>"""
    TMP_HTML.write_text(html, encoding="utf-8")
    out_file = IMG_DIR / item["name"]
    cmd = [
        EDGE,
        "--headless",
        "--disable-gpu",
        f"--window-size={item['width']},{item['height']}",
        "--default-background-color=00000000",
        f"--screenshot={out_file}",
        TMP_HTML.as_uri()
    ]
    subprocess.run(cmd, check=True)
    print(f"Generated {out_file.name}")

if TMP_HTML.exists():
    TMP_HTML.unlink()
print("Done!")
