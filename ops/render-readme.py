"""Render original NEYLO README artwork. Optional: Python 3 + Pillow; run after npm ci."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs/assets"
OUT.mkdir(parents=True, exist_ok=True)
S = 2
W, H = 1200, 650
FONT = ROOT / "node_modules/geist/dist/fonts/geist-sans"
INK, MUTED, QUIET = "#F3F6FF", "#A5B5CE", "#8194B2"

def font(size, weight="Regular"):
    return ImageFont.truetype(str(FONT / f"Geist-{weight}.ttf"), round(size*S))

def text(draw, xy, value, size, fill=INK, weight="Regular", anchor=None):
    draw.text(tuple(round(v*S) for v in xy), value, font=font(size,weight), fill=fill, anchor=anchor)

def line(draw, points, fill, width=1):
    draw.line([(round(x*S),round(y*S)) for x,y in points], fill=fill, width=max(1,round(width*S)))

def circle(draw,x,y,r,fill=None,outline=None,width=1):
    draw.ellipse(tuple(round(v*S) for v in (x-r,y-r,x+r,y+r)),fill=fill,outline=outline,width=round(width*S))

base = Image.new("RGB",(W*S,H*S),"#050913")
ambient = Image.new("RGBA",base.size)
ad = ImageDraw.Draw(ambient)
ad.ellipse((640*S,-130*S,1320*S,480*S),fill=(37,67,132,70))
ambient=ambient.filter(ImageFilter.GaussianBlur(120*S))
base=Image.alpha_composite(base.convert("RGBA"),ambient)
d=ImageDraw.Draw(base)
# Original folded N mark, restrained wordmark and edition label.
line(d,[(66,83),(66,50),(90,82),(90,49)],"#D4DFFF",2.5)
line(d,[(73,82),(73,64),(84,79)],"#7598FF",1.5)
text(d,(104,41),"neylo",36,weight="SemiBold")
text(d,(1135,63),"PRODUCT / ENGINEERING",12,QUIET,anchor="rm")
line(d,[(65,112),(1135,112)],"#1A2942")
text(d,(64,151),"ONE IDENTITY. LESS FRICTION.",12,"#7598FF",weight="Medium")
text(d,(60,194),"One address",73,weight="Medium")
text(d,(60,272),"for money.",73,weight="Medium")
text(d,(65,373),"A simpler way to send and receive.",21,MUTED)
text(d,(65,408),"Built around your @handle.",21,MUTED)
d.rounded_rectangle((65*S,469*S,264*S,515*S),radius=23*S,fill="#13274D",outline="#37578C",width=S)
text(d,(87,483),"JOIN THE WAITLIST",12,"#DCE6FF",weight="Medium")
line(d,[(236,496),(243,489),(237,489)],INK,1.5)
line(d,[(243,489),(243,495)],INK,1.5)

CW,CH=500,300
card = Image.new("RGBA",(CW*S,CH*S))
cd=ImageDraw.Draw(card)
for y in range(CH*S):
    t=y/(CH*S)
    col=tuple(round(a+(b-a)*t) for a,b in zip((36,63,100),(13,27,49)))+(255,)
    cd.line((0,y,CW*S,y),fill=col)
texture=Image.new("RGBA",card.size)
td=ImageDraw.Draw(texture)
for x in range(-220,700,13):
    td.line((x*S,CH*S,(x+200)*S,0),fill=(118,154,210,13),width=S)
card=Image.alpha_composite(card,texture)
cd=ImageDraw.Draw(card)
mask=Image.new("L",card.size)
ImageDraw.Draw(mask).rounded_rectangle((1,1,CW*S-2,CH*S-2),radius=24*S,fill=255)
card.putalpha(mask)
cd.rounded_rectangle((1*S,1*S,(CW-1)*S,(CH-1)*S),radius=24*S,outline="#5B7397",width=S)
cd.rounded_rectangle((5*S,5*S,(CW-5)*S,(CH-5)*S),radius=21*S,outline=(166,189,224,35),width=S)
text(cd,(28,22),"neylo",29,weight="SemiBold")
text(cd,(470,37),"EARLY ACCESS",10,"#B3C5DE",weight="Medium",anchor="rm")
text(cd,(29,113),"@yourname",49,weight="Medium")
text(cd,(31,176),"Your money address",13,MUTED)
text(cd,(31,239),"Join the waitlist",20,weight="Medium")
text(cd,(469,260),"neylo.xyz",11,QUIET,anchor="rm")

frames=[]
N=64
for i in range(N):
    t=i/(N-1)
    im=base.copy()
    # Small material highlight; no continuous camera movement or flashing.
    sheen=Image.new("RGBA",card.size)
    sd=ImageDraw.Draw(sheen)
    sx=(-240+950*t)*S
    sd.polygon([(sx,0),(sx+34*S,0),(sx-120*S,CH*S),(sx-160*S,CH*S)],fill=(177,204,244,28))
    sheen=sheen.filter(ImageFilter.GaussianBlur(15*S))
    sheen.putalpha(ImageChops.multiply(sheen.getchannel('A'),mask))
    face=Image.alpha_composite(card,sheen)
    angle=-3.5
    face=face.rotate(angle,Image.Resampling.BICUBIC,expand=True)
    cx,cy=650*S,175*S
    # Minimal physical edge and layered shadows use the same card silhouette.
    shadow=Image.new("RGBA",im.size)
    sil=Image.new("RGBA",face.size,(0,0,0,0)); sil.putalpha(face.getchannel('A'))
    shadow.alpha_composite(sil,(cx+4*S,cy+22*S))
    im=Image.alpha_composite(im,shadow.filter(ImageFilter.GaussianBlur(22*S)))
    edge=Image.new("RGBA",face.size,(52,69,95,255));edge.putalpha(face.getchannel('A'))
    im.alpha_composite(edge,(cx,cy+4*S));im.alpha_composite(face,(cx,cy))
    dr=ImageDraw.Draw(im)
    nodes=[80,600,1120]; y=580;r=11;gap=8
    for j in range(2):
        start,end=nodes[j]+r+gap,nodes[j+1]-r-gap
        line(dr,[(start,y),(end,y)],"#18283F",1)
        p=max(0,min(1,(t-.08-j*.35)/.32))
        p=1-(1-p)**3
        if p>0:line(dr,[(start,y),(start+(end-start)*p,y)],"#7598FF" if j==0 else "#71D7E8",1.5)
    for j,x in enumerate(nodes):
        complete=t>=.08+j*.35
        circle(dr,x,y,r,fill="#71D7E8" if complete and j==2 else "#3457D5" if complete else "#0A1222",outline="#7BA3FF" if complete else "#34435A")
        if complete:
            line(dr,[(x-4,y),(x-1,y+3),(x+5,y-4)],"#050913" if j==2 else "#F3F6FF",1.5)
        else:circle(dr,x,y,2,fill="#8194B2")
    text(dr,(65,609),"01   YOUR IDENTITY",11,MUTED,weight="Medium")
    text(dr,(600,615),"02   YOUR ROUTE",11,MUTED,weight="Medium",anchor="mm")
    text(dr,(1135,615),"03   YOUR DESTINATION",11,MUTED,weight="Medium",anchor="rm")
    frames.append(im.convert("RGB").resize((W,H),Image.Resampling.LANCZOS))

frames[-1].save(OUT/"neylo-hero.png",optimize=True)
# Fixed palette prevents flicker. Two plays, then the complete static composition.
palette=frames[-1].quantize(colors=256,method=Image.Quantize.MEDIANCUT)
quantized=[f.quantize(palette=palette,dither=Image.Dither.NONE) for f in frames]
durations=[90]*N;durations[0]=500;durations[-1]=1800
quantized[0].save(OUT/"neylo-hero.gif",save_all=True,append_images=quantized[1:],duration=durations,loop=1,optimize=True,disposal=1)
print(f"README motion: {N} frames, {(OUT/'neylo-hero.gif').stat().st_size:,} bytes; static companion rendered.")
