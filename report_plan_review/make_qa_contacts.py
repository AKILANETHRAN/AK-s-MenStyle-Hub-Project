from pathlib import Path
from PIL import Image, ImageDraw

source = Path("report/qa_revised")
pages = sorted(source.glob("final-page-*.png"), key=lambda path: int(path.stem.split("-")[-1]))
out = source / "contact"
out.mkdir(exist_ok=True)

for start in range(0, len(pages), 12):
    selected = pages[start:start + 12]
    canvas = Image.new("RGB", (880, 1005), "white")
    draw = ImageDraw.Draw(canvas)
    for index, page in enumerate(selected):
        x, y = (index % 4) * 220, (index // 4) * 335
        canvas.paste(Image.open(page).convert("RGB").resize((220, 311)), (x, y))
        draw.text((x + 6, y + 314), f"Page {start + index + 1}", fill="black")
    canvas.save(out / f"contact-{start // 12 + 1}.png")
