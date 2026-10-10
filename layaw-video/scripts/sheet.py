import sys, glob
from PIL import Image, ImageDraw
out, cols = sys.argv[1], int(sys.argv[2]); files = sys.argv[3:]
ims=[Image.open(f).convert('RGB') for f in files]
w,h=ims[0].size
s=min(1.0, 1800/(cols*w)); tw,th=int(w*s),int(h*s)
rows=(len(ims)+cols-1)//cols
sheet=Image.new('RGB',(cols*tw,rows*th),'black')
for i,(im,f) in enumerate(zip(ims,files)):
    im=im.resize((tw,th)); d=ImageDraw.Draw(im); d.text((8,6),f.split('_')[-1][:-4]+'s',fill=(255,255,0))
    sheet.paste(im,((i%cols)*tw,(i//cols)*th))
sheet.save(out)
