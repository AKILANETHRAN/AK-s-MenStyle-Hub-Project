from pathlib import Path
from PIL import Image, ImageDraw

root = Path(r'D:\PROJECT\AK_MEN_STYLE_FULL_PROJECT\report_revision')
pages = sorted(root.glob('verified-*.png'))
for start in range(0, len(pages), 4):
    selected = pages[start:start + 4]
    sample = Image.open(selected[0])
    w, h = sample.size
    sheet = Image.new('RGB', (2 * w + 30, 2 * h + 50), '#d8d8d8')
    draw = ImageDraw.Draw(sheet)
    for offset, path in enumerate(selected):
        page = Image.open(path).convert('RGB')
        x = (offset % 2) * (w + 10) + 5
        y = (offset // 2) * (h + 20) + 20
        sheet.paste(page, (x, y))
        draw.text((x + 4, y - 17), path.stem, fill='#000000')
    out = root / f'final-contact-pages-{start + 1:02d}-{start + len(selected):02d}.png'
    sheet.save(out)
    print(out.name)
