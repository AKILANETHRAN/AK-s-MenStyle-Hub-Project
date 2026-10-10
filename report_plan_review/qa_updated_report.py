from pathlib import Path
import pypdfium2 as pdfium
from PIL import Image, ImageDraw
out=Path('report/qa_updated')
d=pdfium.PdfDocument(out/'StyleHub_Project_Report_Updated.pdf')
print('Pages:',len(d))
for i,p in enumerate(d):
    p.render(scale=1.3).to_pil().save(str(out/f'page-{i+1}.png'))
    text=p.get_textpage().get_text_range()
    if 'Concern' in text or 'Request Flow' in text:
        print(i+1, text[:100].replace('\n',' '), 'TABLE' if 'Concern' in text else '')
for start in range(0,len(d),9):
    canvas=Image.new('RGB',(1500,2160),'white'); draw=ImageDraw.Draw(canvas)
    for j in range(start,min(start+9,len(d))):
        im=Image.open(out/f'page-{j+1}.png'); im.thumbnail((490,690))
        x=((j-start)%3)*500; y=((j-start)//3)*720
        canvas.paste(im,(x,y)); draw.text((x+10,y+694),str(j+1),fill='black')
    canvas.save(out/f'contact-{start//9+1}.png')
