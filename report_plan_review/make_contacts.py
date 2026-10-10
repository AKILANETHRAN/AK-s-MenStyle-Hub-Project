from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

folder = Path(__file__).resolve().parent
pages = sorted(folder.glob('rev-page-*.png'))
width, height = 340, 500
for batch in range(0, len(pages), 15):
    canvas = Image.new('RGB', (width * 5, height * 3), 'white')
    draw = ImageDraw.Draw(canvas)
    for index, source in enumerate(pages[batch:batch + 15]):
        thumbnail = ImageOps.contain(Image.open(source).convert('RGB'), (width - 12, height - 30))
        x, y = (index % 5) * width, (index // 5) * height
        canvas.paste(thumbnail, (x, y + 20))
        draw.text((x + 4, y + 3), str(batch + index + 1), fill='black')
    canvas.save(folder / f'rev-contact-{batch // 15 + 1}.png')
