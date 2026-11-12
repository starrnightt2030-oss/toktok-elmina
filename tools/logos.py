import sys; sys.path.insert(0, '.')
from shape import shape
F = '../fonts/'; MAR = F + 'Marhey[wght].ttf'; REEM = F + 'ReemKufi[wght].ttf'; LAL = F + 'Lalezar-Regular.ttf'
NAVY, NAVY2, TUK, COPPER, CREAM = '#101B2D', '#20334D', '#F5B928', '#C87938', '#F5F1E8'

def text_at(font, txt, size, cx, base, wght=None, anchor='middle'):
    d, w, a, de = shape(font, txt, size, wght=wght)
    x = cx - w / 2 if anchor == 'middle' else (cx - w if anchor == 'end' else cx)
    d, w, a, de = shape(font, txt, size, wght=wght, x=x, y=base)
    return d, w

def tuk_front(tx, ty, s, glow=True, uid=''):
    """front view of a tuk-tuk, drawn in a 400x420 box, placed at (tx,ty) scale s"""
    return f'''<g transform="translate({tx} {ty}) scale({s})">
  <defs><radialGradient id="hl{uid}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#fff3c4"/><stop offset="1" stop-color="#ffcf4a"/></radialGradient>
  <radialGradient id="hg{uid}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff2b0" stop-opacity=".9"/><stop offset="1" stop-color="#ffcf4a" stop-opacity="0"/></radialGradient>
  <linearGradient id="bd{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD453"/><stop offset=".55" stop-color="{TUK}"/><stop offset="1" stop-color="#D98E12"/></linearGradient>
  <linearGradient id="gl{uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a5878"/><stop offset="1" stop-color="#0d1828"/></linearGradient></defs>
  <path d="M58 92 Q200 52 342 92 L348 112 Q200 84 52 112 Z" fill="#14161b"/>
  <rect x="50" y="98" width="300" height="16" rx="6" fill="#1d2027"/>
  <path d="M62 110 h12 l-8 150 h-12 Z M338 110 h-12 l8 150 h12 Z" fill="#14161b"/>
  <g stroke="#14161b" stroke-width="7" fill="none"><path d="M78 128 Q40 120 26 150"/><path d="M322 128 Q360 120 374 150"/></g>
  <ellipse cx="22" cy="160" rx="16" ry="22" fill="#14161b"/><ellipse cx="378" cy="160" rx="16" ry="22" fill="#14161b"/>
  <ellipse cx="22" cy="160" rx="10" ry="15" fill="#7d9bb8"/><ellipse cx="378" cy="160" rx="10" ry="15" fill="#7d9bb8"/>
  <path d="M96 120 L304 120 Q322 122 324 140 L314 236 L86 236 L76 140 Q78 122 96 120 Z" fill="#14161b"/>
  <path d="M104 130 L296 130 Q310 132 311 146 L303 224 L97 224 L89 146 Q90 132 104 130 Z" fill="url(#gl{uid})"/>
  <path d="M118 134 L170 134 L128 220 L104 220 Z" fill="#ffffff" opacity=".13"/>
  <path d="M84 232 L316 232 Q338 236 336 262 L314 330 Q306 352 276 356 L124 356 Q94 352 86 330 L64 262 Q62 236 84 232 Z" fill="url(#bd{uid})" stroke="#14161b" stroke-width="6"/>
  <path d="M90 246 L310 246" stroke="#ffffff" stroke-opacity=".45" stroke-width="5" stroke-linecap="round"/>
  {'<circle cx="200" cy="290" r="78" fill="url(#hg' + uid + ')"/>' if glow else ''}
  <circle cx="200" cy="290" r="36" fill="#14161b"/><circle cx="200" cy="290" r="28" fill="url(#hl{uid})"/>
  <rect x="96" y="276" width="34" height="18" rx="5" fill="#ff9a1f" stroke="#14161b" stroke-width="4"/><rect x="270" y="276" width="34" height="18" rx="5" fill="#ff9a1f" stroke="#14161b" stroke-width="4"/>
  <rect x="168" y="334" width="64" height="18" rx="3" fill="{CREAM}" stroke="#14161b" stroke-width="3"/>
  <path d="M146 362 Q200 340 254 362 L248 378 Q200 362 152 378 Z" fill="#14161b"/>
  <rect x="172" y="364" width="56" height="54" rx="18" fill="#1d2027"/><rect x="182" y="372" width="36" height="38" rx="10" fill="#3a3d44"/>
</g>'''

def crane(x, y, s, col, w=6):
    """ship-to-shore container crane silhouette, base at (x,y)"""
    return f'''<g transform="translate({x} {y}) scale({s})" stroke="{col}" stroke-width="{w}" fill="none" stroke-linejoin="round" stroke-linecap="round">
  <path d="M0 0 L20 -150 L60 -150 L80 0 M20 -150 L40 -260 L60 -150 M30 -80 L70 -80 M10 -40 L74 -110 M70 -40 L6 -110"/>
  <path d="M-120 -170 L260 -170 M-120 -185 L260 -185 M-120 -170 L-120 -185 M40 -260 L-110 -185 M40 -260 L240 -185"/>
  <path d="M-80 -170 L-60 -185 L-40 -170 L-20 -185 L0 -170 M100 -170 L120 -185 L140 -170 L160 -185 L180 -170 L200 -185 L220 -170"/>
  <path d="M150 -170 L150 -110 M140 -110 h20"/></g>'''

def extruded(d, depth, step, face, side_from, side_to, outline=NAVY, ow=12, uid='x'):
    layers = []
    n = int(depth / step)
    for i in range(n, 0, -1):
        t = i / n
        r1, g1, b1 = [int(side_from[k:k + 2], 16) for k in (1, 3, 5)]; r2, g2, b2 = [int(side_to[k:k + 2], 16) for k in (1, 3, 5)]
        c = '#%02x%02x%02x' % (round(r1 + (r2 - r1) * t), round(g1 + (g2 - g1) * t), round(b1 + (b2 - b1) * t))
        layers.append(f'<path d="{d}" transform="translate({i * step * .45:.1f} {i * step})" fill="{c}" stroke="{c}" stroke-width="{ow}" stroke-linejoin="round"/>')
    return ''.join(layers) + f'<path d="{d}" fill="{face}" stroke="{outline}" stroke-width="{ow}" stroke-linejoin="round" paint-order="stroke"/>'

# =============================================================== A — cinematic 3D wordmark (1600 x 900)
def logo_A(bg=True):
    W, H = 1600, 900
    d1, w1 = text_at(MAR, 'توكتوك', 330, 930, 440, 800)
    d2, w2 = text_at(MAR, 'في المينا', 180, 980, 690, 800)
    face = '''<linearGradient id="fA" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox"><stop offset="0" stop-color="#FFF0A8"/><stop offset=".38" stop-color="#FFD24A"/><stop offset=".62" stop-color="#F5B928"/><stop offset="1" stop-color="#D88A12"/></linearGradient>
    <linearGradient id="fA2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7D7A8"/><stop offset=".5" stop-color="#E39A55"/><stop offset="1" stop-color="#A9592A"/></linearGradient>
    <radialGradient id="sunA" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd27a"/><stop offset=".55" stop-color="#ff8a4a" stop-opacity=".85"/><stop offset="1" stop-color="#ff6a3a" stop-opacity="0"/></radialGradient>
    <linearGradient id="skyA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1424"/><stop offset=".55" stop-color="#2b2a55"/><stop offset=".8" stop-color="#8a4a5a"/><stop offset="1" stop-color="#d9784a"/></linearGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="18"/></filter>'''
    g = []
    if bg: g.append(f'<rect width="{W}" height="{H}" fill="url(#skyA)"/>')
    g.append(f'<circle cx="420" cy="520" r="330" fill="url(#sunA)"/>')
    g.append(crane(250, 760, 1.55, COPPER, 7)); g.append(crane(1250, 760, 1.25, '#7a8aa3', 6))
    g.append(f'<rect x="120" y="740" width="1360" height="20" rx="10" fill="{NAVY2}" opacity=".9"/>')
    for i, (cx, cc) in enumerate([(1330, '#2e5e8c'), (1385, '#b23a2a'), (1440, '#d6802b')]):
        g.append(f'<rect x="{cx - 50}" y="{700 - (i % 2) * 34}" width="110" height="40" rx="3" fill="{cc}" stroke="{NAVY}" stroke-width="4"/>')
    g.append(f'<ellipse cx="800" cy="600" rx="660" ry="230" fill="{NAVY}" opacity=".55" filter="url(#soft)"/>')
    g.append(extruded(d2, 16, 2, 'url(#fA2)', '#5a2d14', '#101B2D', NAVY, 12))
    g.append(extruded(d1, 26, 2, 'url(#fA)', '#8a4a12', '#101B2D', NAVY, 16))
    g.append(f'<clipPath id="cA"><path d="{d1}"/></clipPath><rect x="0" y="180" width="{W}" height="230" fill="url(#shine)" clip-path="url(#cA)"/>')
    g.append(f'<ellipse cx="290" cy="812" rx="170" ry="22" fill="#000" opacity=".45"/>')
    g.append(tuk_front(110, 440, .9, True, 'A'))
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><defs>{face}</defs>{"".join(g)}</svg>'

# =============================================================== B — app-icon mark (1024 square)
def logo_B(text=True, size=1024, full=False):
    W = 1024
    d1, w1 = text_at(REEM, 'توكتوك', 220, 512, 800, 700)
    d2, w2 = text_at(REEM, 'في المينا', 120, 512, 945, 700)
    defs = f'''<linearGradient id="bgB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2c48"/><stop offset=".6" stop-color="{NAVY}"/><stop offset="1" stop-color="#0a1220"/></linearGradient>
    <linearGradient id="sB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a52" stop-opacity="0"/><stop offset="1" stop-color="#ff8a4a" stop-opacity=".55"/></linearGradient>
    <clipPath id="rB"><rect width="1024" height="1024" rx="{0 if full else 224}"/></clipPath>'''
    g = [f'<g clip-path="url(#rB)"><rect width="1024" height="1024" fill="url(#bgB)"/>']
    g.append(f'<rect y="300" width="1024" height="212" fill="url(#sB)"/>'); g.append(crane(120, 512, 1.5, COPPER, 9)); g.append(f'<rect y="508" width="1024" height="10" fill="{COPPER}" opacity=".7"/>')
    if text:
        g.append(f'<ellipse cx="512" cy="505" rx="170" ry="18" fill="#000" opacity=".5"/>')
        g.append(tuk_front(322, 92, .95, True, 'B'))
        g.append(f'<path d="{d1}" fill="{TUK}" stroke="{NAVY}" stroke-width="22" stroke-linejoin="round" paint-order="stroke"/>')
        g.append(f'<path d="{d2}" fill="#E39A55" stroke="{NAVY}" stroke-width="16" stroke-linejoin="round" paint-order="stroke"/>')
    else:
        g.append(tuk_front(212, 140, 1.5, True, 'B2'))
    g.append('</g>' if full else f'<rect x="10" y="10" width="1004" height="1004" rx="216" fill="none" stroke="{TUK}" stroke-width="20"/></g>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 1024 1024"><defs>{defs}</defs>{"".join(g)}</svg>'

# =============================================================== C — circular port badge (1024 square)
def logo_C():
    d1, w1 = text_at(LAL, 'توكتوك في المينا', 150, 512, 778)
    defs = f'''<linearGradient id="skyC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a2547"/><stop offset=".5" stop-color="#5a3f78"/><stop offset=".78" stop-color="#e0805a"/><stop offset="1" stop-color="#ffb36a"/></linearGradient>
    <radialGradient id="ringC" cx=".5" cy=".5" r=".5"><stop offset=".86" stop-color="#E39A55"/><stop offset=".93" stop-color="{COPPER}"/><stop offset="1" stop-color="#7a3f1c"/></radialGradient>
    <linearGradient id="fC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE48A"/><stop offset=".6" stop-color="{TUK}"/><stop offset="1" stop-color="#D98E12"/></linearGradient>
    <clipPath id="inC"><circle cx="512" cy="512" r="420"/></clipPath>'''
    g = [f'<circle cx="512" cy="512" r="500" fill="url(#ringC)" stroke="{NAVY}" stroke-width="14"/>']
    for k in range(24):
        import math; a = k / 24 * 2 * math.pi; g.append(f'<circle cx="{512 + 462 * math.cos(a):.1f}" cy="{512 + 462 * math.sin(a):.1f}" r="11" fill="#7a3f1c" stroke="#f3c08a" stroke-width="3"/>')
    g.append(f'<circle cx="512" cy="512" r="424" fill="{NAVY}"/><g clip-path="url(#inC)"><rect x="80" y="80" width="864" height="520" fill="url(#skyC)"/>')
    g.append('<circle cx="512" cy="560" r="150" fill="#ffd27a" opacity=".9"/>')
    g.append(crane(150, 600, 1.3, NAVY2, 8)); g.append(crane(760, 600, 1.05, NAVY2, 7))
    for i, c in enumerate(['#2e5e8c', '#b23a2a', '#d6802b', '#3b7a4a']):
        g.append(f'<rect x="{330 + i * 92}" y="{548 - (i % 2) * 36}" width="88" height="36" fill="{c}" stroke="{NAVY}" stroke-width="4"/>')
    g.append(f'<rect x="80" y="596" width="864" height="380" fill="#16314f"/>')
    for i in range(6): g.append(f'<path d="M80 {620 + i * 26} q40 -12 80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0" stroke="#5f86b0" stroke-opacity="{.5 - i * .06:.2f}" stroke-width="5" fill="none"/>')
    g.append('</g>')
    # banner
    g.append(f'<path d="M40 650 L984 650 L1010 740 L984 830 L40 830 L14 740 Z" fill="{NAVY}" stroke="{COPPER}" stroke-width="12" stroke-linejoin="round"/>')
    g.append(f'<path d="{d1}" fill="url(#fC)" stroke="#000000" stroke-opacity=".35" stroke-width="10" stroke-linejoin="round" paint-order="stroke" transform="translate(0 6)"/>')
    g.append(f'<path d="{d1}" fill="url(#fC)"/>')
    g.append(f'<ellipse cx="512" cy="640" rx="150" ry="16" fill="#000" opacity=".45"/>')
    g.append(tuk_front(347, 308, .82, True, 'C'))
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs>{defs}</defs>{"".join(g)}</svg>'

open('A.svg', 'w').write(logo_A()); open('A_t.svg', 'w').write(logo_A(False))
open('B.svg', 'w').write(logo_B()); open('B_icon.svg', 'w').write(logo_B(False))
open('C.svg', 'w').write(logo_C())
open('B_full.svg','w').write(logo_B(True,1024,True))
# maskable: content scaled into the 80% safe zone on a full-bleed background
b=logo_B(True,1024,True); inner=b.split('<defs>',1)[1]
open('B_mask.svg','w').write('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#101B2D"/><g transform="translate(102 102) scale(.8)"><defs>'+inner.replace('</svg>','')+'</g></svg>')
print('ok')
