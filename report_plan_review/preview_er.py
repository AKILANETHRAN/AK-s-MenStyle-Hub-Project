"""Raster contact sheet for checking the editable ER page geometry."""

from pathlib import Path
from xml.etree import ElementTree as ET
from PIL import Image, ImageDraw, ImageFont


folder = Path(__file__).resolve().parent
source = folder.parent / 'report/StyleHub_ER_Diagram.drawio'
tree = ET.parse(source)
font_path = Path('C:/Windows/Fonts/times.ttf')
normal = ImageFont.truetype(str(font_path), 15) if font_path.exists() else ImageFont.load_default()
small = ImageFont.truetype(str(font_path), 12) if font_path.exists() else ImageFont.load_default()
title = ImageFont.truetype(str(font_path), 20) if font_path.exists() else ImageFont.load_default()

for page_number, page in enumerate(tree.findall('.//diagram'), 1):
    image = Image.new('RGB', (1123, 794), 'white')
    draw = ImageDraw.Draw(image)
    cells = {c.get('id'): c for c in page.findall('.//mxCell') if c.get('id')}

    def bounds(cell):
        geo = cell.find('mxGeometry')
        return tuple(float(geo.get(k)) for k in ('x', 'y', 'width', 'height'))

    def center(cell):
        x, y, w, h = bounds(cell)
        return (x + w / 2, y + h / 2)

    for cell in cells.values():
        if cell.get('edge') == '1':
            a, b = cells[cell.get('source')], cells[cell.get('target')]
            waypoints = [
                (float(point.get('x')), float(point.get('y')))
                for point in cell.findall('./mxGeometry/Array/mxPoint')
            ]
            draw.line([center(a), *waypoints, center(b)], fill='black', width=1)

    for cell in cells.values():
        if cell.get('vertex') != '1':
            continue
        x, y, w, h = bounds(cell)
        style = cell.get('style', '')
        label = cell.get('value', '').replace('<u>', '').replace('</u>', '')
        if 'rectangle;' in style:
            draw.rectangle((x, y, x + w, y + h), fill='white', outline='black', width=2)
        elif 'rhombus;' in style:
            draw.polygon([(x+w/2, y), (x+w, y+h/2), (x+w/2, y+h), (x, y+h/2)], fill='white', outline='black')
        elif 'ellipse;' in style:
            draw.ellipse((x, y, x + w, y + h), fill='white', outline='black', width=1)
        if label:
            chosen = title if cell.get('id') == 'title' else (
                small if ('legend' in cell.get('id') or 'page-note' in cell.get('id')
                          or 'ellipse;' in style) else normal)
            draw.text((x+w/2, y+h/2), label, fill='black', font=chosen, anchor='mm')

    for cell in cells.values():
        if cell.get('edge') == '1' and cell.get('value'):
            a, b = cells[cell.get('source')], cells[cell.get('target')]
            ax, ay = center(a); bx, by = center(b)
            draw.text(((ax+bx)/2, (ay+by)/2), cell.get('value'), fill='black', font=small, anchor='mm', stroke_width=2, stroke_fill='white')

    image.save(folder / f'er-preview-{page_number}.png')
