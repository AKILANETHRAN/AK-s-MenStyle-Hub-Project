from pathlib import Path
from io import BytesIO
from docx import Document
from docx.oxml.ns import qn
from PIL import Image, ImageDraw, ImageFont

SOURCE = Path(r'C:\Users\HARIRAAM\Documents\StyleHub_Project_Report_Final (2).docx')
OUT = Path(r'D:\PROJECT\AK_MEN_STYLE_FULL_PROJECT\report_revision')
OUT.mkdir(exist_ok=True)
doc = Document(SOURCE)
records = []
for index, paragraph in enumerate(doc.paragraphs):
    for blip in paragraph._element.xpath('.//a:blip'):
        rid = blip.get(qn('r:embed'))
        if not rid:
            continue
        part = doc.part.related_parts[rid]
        image = Image.open(BytesIO(part.blob)).convert('RGB')
        suffix = Path(str(part.partname)).suffix or '.png'
        path = OUT / f'{rid}{suffix}'
        path.write_bytes(part.blob)
        records.append((index, rid, image.size, paragraph.text[:90], image))

for index, rid, size, caption, _ in records:
    print(index, rid, size, repr(caption))

for group_name, selected in [('vton', [r for r in records if 308 <= r[0] <= 328]),
                             ('other', [r for r in records if 103 <= r[0] <= 379 and not 308 <= r[0] <= 328])]:
    if not selected:
        continue
    width, cell_h, cell_w = 1200, 245, 400
    rows = (len(selected) + 2) // 3
    sheet = Image.new('RGB', (width, rows * cell_h), '#ffffff')
    draw = ImageDraw.Draw(sheet)
    for i, (index, rid, size, caption, img) in enumerate(selected):
        x, y = (i % 3) * cell_w, (i // 3) * cell_h
        thumb = img.copy()
        thumb.thumbnail((cell_w - 16, cell_h - 48))
        sheet.paste(thumb, (x + (cell_w - thumb.width) // 2, y + 28))
        draw.text((x + 8, y + 5), f'{rid}  p{index}  {size[0]}x{size[1]}', fill='#000000')
    sheet.save(OUT / f'contact_{group_name}.png')
