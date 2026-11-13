"""Traffic vehicles seen on Alexandria streets, built in Blender and exported to one GLB.

Run:  python3 tools/build_cars.py public/models/cars.glb [render_dir]
Top-level objects (game looks them up by name): Sedan, Classic, Taxi, Micro, Truck.
Blender +Y = forward, +Z = up. Material "Paint" is recoloured per car in game.
"""
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix

OUT = sys.argv[1] if len(sys.argv) > 1 else 'cars.glb'
RENDER = sys.argv[2] if len(sys.argv) > 2 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene; col = scn.collection

def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)

def mat(name, hexc, rough=0.5, metal=0.0, emit=0.0, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*srgb(hexc), 1)
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if coat: b.inputs['Coat Weight'].default_value = coat
    if emit:
        b.inputs['Emission Color'].default_value = (*srgb(hexc), 1); b.inputs['Emission Strength'].default_value = emit
    return m

M = dict(
    paint=mat('Paint', 'e9e9e9', 0.28, 0.15, coat=1.0),
    black=mat('Trim', '141518', 0.5),
    glass=mat('Glass', '1d2a33', 0.06, 0.3),
    chrome=mat('Chrome', 'dfe3e8', 0.1, 1.0),
    rubber=mat('Tyre', '151517', 0.9),
    rim=mat('Rim', 'b5bac0', 0.3, 0.85),
    head=mat('HeadLamp', 'fff4dc', 0.05, 0.0, emit=2.0),
    tail=mat('TailLamp', 'c4140c', 0.2, 0.0, emit=0.8),
    amber=mat('Amber', 'ff9a10', 0.2, 0.0, emit=0.5),
    plate=mat('Plate', 'f4f4f0', 0.5),
    taxiY=mat('TaxiYellow', 'f2b705', 0.3, 0.1, coat=1.0),
    taxiK=mat('TaxiBlack', '16171a', 0.3, 0.1, coat=1.0),
    white=mat('White', 'f1f1ee', 0.35, 0.1, coat=0.6),
    blue=mat('Stripe', '1f5fa8', 0.4),
    red=mat('CabRed', 'b8231b', 0.3, 0.1, coat=0.8),
    steel=mat('Steel', '6c7278', 0.45, 0.8),
    sign=mat('TaxiSign', 'fff2c0', 0.3, 0.0, emit=0.6),
    green=mat('Stripe2', '2f8f4a', 0.4),
    curtain=mat('Curtain', 'e9d9b5', 0.9),
    seat=mat('SeatFabric', '6b4a3a', 0.9),
    floor=mat('Floor', '2a2b2e', 0.95),
    skin=mat('Skin', '8f6446', 0.6),
    shirt=mat('Shirt', 'c9b48d', 0.8),
    hair=mat('Hair', '1d1712', 0.7),
    luggage=mat('Luggage', '3d5a7a', 0.8),
    luggage2=mat('Luggage2', '8a5a2a', 0.8),
)
M['glassT'] = mat('GlassClear', '1d2a33', 0.06, 0.3)
_gb = M['glassT'].node_tree.nodes['Principled BSDF']; _gb.inputs['Alpha'].default_value = 0.45; M['glassT'].surface_render_method = 'BLENDED'


def obj(name, bm, m_list):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); col.objects.link(ob)
    for m in m_list: me.materials.append(m)
    return ob

def bevel(ob, w, seg=2, ang=32):
    md = ob.modifiers.new('bev', 'BEVEL'); md.width = w; md.segments = seg
    md.limit_method = 'ANGLE'; md.angle_limit = math.radians(ang)
    for p in ob.data.polygons: p.use_smooth = True
    return ob

def box(x0, x1, y0, y1, z0, z1, m, bv=0.0):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts:
        v.co = Vector(((x0+x1)/2 + v.co.x*(x1-x0), (y0+y1)/2 + v.co.y*(y1-y0), (z0+z1)/2 + v.co.z*(z1-z0)))
    ob = obj('box', bm, [m])
    return bevel(ob, bv) if bv else ob

def cyl(r, depth, loc, m, axis='X', seg=20):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=depth)
    rot = {'Z': Matrix(), 'X': Matrix.Rotation(math.pi/2, 4, 'Y'), 'Y': Matrix.Rotation(math.pi/2, 4, 'X')}[axis]
    bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector(loc)) @ rot, verts=bm.verts)
    ob = obj('cyl', bm, [m])
    for p in ob.data.polygons: p.use_smooth = True
    return ob

def arch(cy, cz, r, seg=9):
    """Points over a wheel arch, rear to front (y increasing)."""
    return [(cy - r*math.cos(math.pi*i/seg), cz + r*math.sin(math.pi*i/seg)) for i in range(seg+1)]

def extrude(name, prof, hw, mats, face_mat=None, top_scale=None):
    """Extrude a side profile [(y,z)...] across x=±hw. face_mat(i) picks a material
    index for the strip face of profile edge i. top_scale=(z0,z1,s) narrows x above z0."""
    bm = bmesh.new()
    def sx(z):
        if not top_scale: return 1.0
        z0, z1, s = top_scale
        return 1.0 if z <= z0 else 1.0 - (1.0 - s) * min(1, (z - z0) / (z1 - z0))
    L = [bm.verts.new((-hw*sx(z), y, z)) for y, z in prof]
    R = [bm.verts.new((hw*sx(z), y, z)) for y, z in prof]
    n = len(prof)
    fl = bm.faces.new(L[::-1]); fr = bm.faces.new(R)
    for i in range(n):
        j = (i + 1) % n
        f = bm.faces.new((L[i], L[j], R[j], R[i]))
        if face_mat: f.material_index = face_mat(i)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.triangulate(bm, faces=[fl, fr], ngon_method='EAR_CLIP')
    return obj(name, bm, mats)

def panel(pts, xfun, m, side):
    """Flat window/decal panel on a car side, pts [(y,z)], x from xfun(z)."""
    bm = bmesh.new()
    vs = [bm.verts.new((side*xfun(z), y, z)) for y, z in pts]
    f = bm.faces.new(vs if side > 0 else vs[::-1])
    bm.normal_update()
    return obj('pan', bm, [m])

def wheel(y, x, r, w, z=None, rim_r=None):
    z = r if z is None else z
    t = cyl(r, w, (x, y, z), M['rubber'], seg=22)
    s = 1 if x > 0 else -1
    rm = cyl(rim_r or r*0.62, 0.02, (x + s*w/2, y, z), M['rim'], seg=16)
    hub = cyl(r*0.18, 0.03, (x + s*(w/2+0.015), y, z), M['chrome'], seg=10)
    return [t, rm, hub]

def finish(name, parts):
    """Apply modifiers and join all parts into one object named `name`."""
    dg = bpy.context.evaluated_depsgraph_get()
    for o in bpy.context.selected_objects: o.select_set(False)
    for o in parts:
        if o.modifiers:
            bpy.context.view_layer.objects.active = o
            for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    j = bpy.context.view_layer.objects.active; j.name = name; j.data.name = name
    for o in bpy.context.selected_objects: o.select_set(False)
    return j

# ------------------------------------------------------------ modern sedan / taxi
def sedan(name, L=4.4, W=1.72, taxi=False):
    hw = W/2; f = L/2; wf, wr, wz, wr_ = f-0.85, -f+0.9, 0.31, 0.39
    low = [(f, 0.40), (f+0.02, 0.56), (f-0.02, 0.72), (f-0.15, 0.80), (0.95, 0.92), (-1.25, 0.96),
           (-f+0.15, 0.95), (-f, 0.80), (-f+0.02, 0.48), (-f+0.1, 0.36)]
    low += arch(wr, wz, wr_) + arch(wf, wz, wr_) + [(f-0.2, 0.36)]
    if taxi:
        mats = [M['taxiY'], M['taxiK']]
    else:
        mats = [M['paint']]
    body = bevel(extrude(name+'Low', low, hw, mats), 0.06, 3)
    if taxi:  # Alexandria taxi: black nose and tail, yellow cabin section
        for p in body.data.polygons:
            if abs(p.center.y) > 1.15: p.material_index = 1
    gh = [(0.95, 0.92), (0.15, 1.42), (-0.9, 1.45), (-1.55, 0.96)]
    gW = hw*0.94
    gmats = [M['taxiK'] if taxi else M['paint'], M['glass']]
    top = bevel(extrude(name+'Top', gh, gW, gmats, face_mat=lambda i: 1 if i in (0, 2) else 0,
                        top_scale=(0.94, 1.45, 0.86)), 0.05, 3)
    xs = lambda z: gW*(1 - 0.14*min(1, max(0, (z-0.94)/0.51))) + 0.006
    parts = [body, top]
    for s in (1, -1):
        parts.append(panel([(0.80, 0.99), (-0.22, 0.99), (-0.22, 1.37), (0.14, 1.36)], xs, M['glass'], s))
        parts.append(panel([(-0.32, 0.99), (-1.36, 1.0), (-0.88, 1.38), (-0.32, 1.38)], xs, M['glass'], s))
        x = s*(hw-0.12)
        parts += wheel(wf, x, 0.31, 0.21) + wheel(wr, x, 0.31, 0.21)
        parts.append(box(s*0.86, s*0.98, 0.78, 0.92, 0.96, 1.06, M['black'], 0.02))          # mirror
        parts.append(box(s*(hw-0.02), s*(hw+0.01), 0.1, 0.25, 0.82, 0.85, M['chrome']))      # handles
        parts.append(box(s*(hw-0.02), s*(hw+0.01), -0.95, -0.8, 0.83, 0.86, M['chrome']))
        parts.append(box(s*0.48, s*0.80, f-0.1, f+0.03, 0.62, 0.72, M['head'], 0.02))         # headlamp
        parts.append(box(s*0.52, s*0.82, -f-0.03, -f+0.1, 0.74, 0.86, M['tail'], 0.02))       # tail lamp
        parts.append(box(s*0.80, s*0.86, f-0.05, f+0.03, 0.62, 0.70, M['amber']))
    parts.append(box(-0.42, 0.42, f-0.05, f+0.04, 0.52, 0.66, M['black'], 0.02))              # grille
    parts.append(box(-hw-0.01, hw+0.01, f-0.12, f+0.06, 0.36, 0.48, M['black'], 0.04))        # bumpers
    parts.append(box(-hw-0.01, hw+0.01, -f-0.06, -f+0.12, 0.38, 0.50, M['black'], 0.04))
    parts.append(box(-0.24, 0.24, f+0.04, f+0.07, 0.38, 0.48, M['plate']))
    parts.append(box(-0.22, 0.22, -f-0.07, -f-0.03, 0.56, 0.68, M['plate']))
    if taxi:
        parts.append(box(-0.32, 0.32, -0.55, -0.25, 1.44, 1.62, M['sign'], 0.03))
        parts.append(box(-0.36, 0.36, -0.58, -0.22, 1.43, 1.47, M['black']))
    finish(name, parts)

# ------------------------------------------------------------ classic boxy saloon (Fiat 128 / Lada)
def classic(name, L=4.05, W=1.62):
    hw = W/2; f = L/2; wf, wr, wz, ar = f-0.75, -f+0.8, 0.3, 0.37
    low = [(f, 0.42), (f, 0.80), (f-0.05, 0.84), (0.8, 0.88), (-1.2, 0.90), (-f+0.05, 0.88), (-f, 0.84),
           (-f, 0.42)] + arch(wr, wz, ar) + arch(wf, wz, ar)
    body = bevel(extrude(name+'Low', low, hw, [M['paint']]), 0.035, 2)
    gh = [(0.8, 0.88), (0.25, 1.36), (-0.85, 1.38), (-1.25, 0.90)]
    gW = hw*0.95
    top = bevel(extrude(name+'Top', gh, gW, [M['paint'], M['glass']], face_mat=lambda i: 1 if i in (0, 2) else 0,
                        top_scale=(0.9, 1.38, 0.9)), 0.03, 2)
    xs = lambda z: gW*(1 - 0.1*min(1, max(0, (z-0.9)/0.48))) + 0.006
    parts = [body, top]
    for s in (1, -1):
        parts.append(panel([(0.66, 0.94), (-0.25, 0.94), (-0.25, 1.32), (0.25, 1.32)], xs, M['glass'], s))
        parts.append(panel([(-0.33, 0.94), (-1.12, 0.95), (-0.82, 1.33), (-0.33, 1.33)], xs, M['glass'], s))
        x = s*(hw-0.11)
        parts += wheel(wf, x, 0.29, 0.18, rim_r=0.17) + wheel(wr, x, 0.29, 0.18, rim_r=0.17)
        parts.append(cyl(0.085, 0.05, (s*0.58, f+0.01, 0.68), M['head'], axis='Y', seg=16))     # round lamps
        parts.append(cyl(0.10, 0.04, (s*0.58, f-0.005, 0.68), M['chrome'], axis='Y', seg=16))
        parts.append(box(s*0.5, s*0.76, -f-0.03, -f+0.05, 0.66, 0.78, M['tail']))
        parts.append(box(s*0.84, s*0.9, 0.62, 0.72, 0.92, 0.99, M['chrome']))
        parts.append(box(s*(hw-0.01), s*(hw+0.01), -0.2, 1.7, 0.70, 0.73, M['chrome']))        # side strip
    parts.append(box(-0.42, 0.42, f-0.02, f+0.03, 0.58, 0.78, M['black']))
    parts.append(box(-hw, hw, f-0.03, f+0.1, 0.42, 0.52, M['chrome'], 0.02))
    parts.append(box(-hw, hw, -f-0.1, -f+0.03, 0.42, 0.52, M['chrome'], 0.02))
    parts.append(box(-0.22, 0.22, f+0.1, f+0.12, 0.40, 0.50, M['plate']))
    parts.append(box(-0.2, 0.2, -f-0.04, -f-0.02, 0.55, 0.65, M['plate']))
    finish(name, parts)

# ------------------------------------------------------------ microbus: Toyota HiAce cab-over, the Alexandria "ميكروباص"
# Same build quality as the player's Suzuki: framed glass, pillars, sliding door with rail, mirrors, grille, lamps, bumpers,
# roof rack with luggage, curtains, four rows of benches and a driver inside, blue/green stripe.
def micro(name, L=4.75, W=1.70):
    hw, f = W / 2, L / 2
    wf, wr, wz, ar = f - 0.62, -f + 0.92, 0.33, 0.38
    prof = [(f - 0.04, 0.32), (f, 0.45), (f + 0.01, 0.70), (f - 0.02, 1.02), (f - 0.10, 1.12), (f - 0.42, 1.92), (f - 0.58, 2.02),
            (-f + 0.06, 2.04), (-f, 1.94), (-f, 0.36)] + arch(wr, wz, ar) + arch(wf, wz, ar)
    body = bevel(extrude(name + 'Body', prof, hw, [M['white'], M['glassT']], face_mat=lambda i: 1 if i == 4 else 0,
                         top_scale=(1.15, 2.04, 0.94)), 0.06, 3)
    xs = lambda z: hw * (1 - 0.06 * min(1, max(0, (z - 1.15) / 0.89))) + 0.006
    parts = [body]
    def window(pts, s):
        cy = sum(p[0] for p in pts) / len(pts); cz = sum(p[1] for p in pts) / len(pts)
        grow = [(y + (0.03 if y > cy else -0.03), z + (0.03 if z > cz else -0.03)) for y, z in pts]
        parts.append(panel(grow, lambda z: xs(z) - 0.002, M['black'], s)); parts.append(panel(pts, xs, M['glassT'], s))
    for s in (1, -1):
        window([(f - 0.16, 1.18), (f - 0.46, 1.84), (f - 0.92, 1.86), (f - 0.92, 1.18)], s)                       # cab door
        y = f - 1.08
        for k in range(3):                                                                                       # side windows
            window([(y, 1.22), (y, 1.86), (y - 0.86, 1.87), (y - 0.86, 1.22)], s); y -= 1.0
        window([(y, 1.22), (y, 1.87), (-f + 0.12, 1.87), (-f + 0.08, 1.74), (-f + 0.08, 1.22)], s)               # rear quarter
        for yy in (f - 0.92, f - 1.08, f - 1.94, f - 2.08, f - 2.94, f - 3.08):                                   # pillars
            parts.append(panel([(yy, 1.16), (yy, 1.9), (yy - 0.03, 1.9), (yy - 0.03, 1.16)], lambda z: xs(z) - 0.001, M['black'], s))
        sx = lambda z: hw + 0.008
        parts.append(panel([(f - 0.03, 1.02), (-f + 0.04, 1.02), (-f + 0.04, 1.10), (f - 0.03, 1.10)], sx, M['blue'], s))      # stripe
        parts.append(panel([(f - 0.03, 0.96), (-f + 0.04, 0.96), (-f + 0.04, 0.99), (f - 0.03, 0.99)], sx, M['green'], s))
        for yy in (f - 0.92, f - 1.08, -0.62, -1.5):                                                                         # door seams
            parts.append(panel([(yy + 0.006, 0.38), (yy + 0.006, 1.14), (yy - 0.006, 1.14), (yy - 0.006, 0.38)], sx, M['black'], s))
        parts.append(panel([(f - 1.1, 1.13), (-1.6, 1.13), (-1.6, 1.15), (f - 1.1, 1.15)], sx, M['steel'], s))                # sliding rail
        parts.append(box(s * (hw - 0.01), s * (hw + 0.016), f - 1.0, f - 0.88, 0.95, 0.99, M['black'], 0.006))              # handles
        parts.append(box(s * (hw - 0.01), s * (hw + 0.016), -0.5, -0.38, 0.95, 0.99, M['black'], 0.006))
        parts.append(box(s * (hw - 0.03), s * (hw + 0.14), f - 0.30, f - 0.27, 1.18, 1.21, M['black']))                     # mirror arm
        parts.append(box(s * (hw + 0.10), s * (hw + 0.19), f - 0.33, f - 0.22, 1.02, 1.32, M['black'], 0.02))                # mirror
        parts.append(box(s * 0.44, s * 0.74, f - 0.01, f + 0.04, 0.70, 0.86, M['head'], 0.015))                               # headlamps
        parts.append(box(s * 0.42, s * 0.76, f - 0.02, f + 0.025, 0.68, 0.88, M['chrome'], 0.01))
        parts.append(box(s * 0.62, s * 0.78, f + 0.02, f + 0.06, 0.52, 0.60, M['amber'], 0.01))                              # turn signals
        parts.append(box(s * (hw - 0.17), s * (hw - 0.02), -f - 0.035, -f + 0.02, 0.62, 1.02, M['tail'], 0.012))             # tail lamps
        parts.append(box(s * (hw - 0.17), s * (hw - 0.02), -f - 0.035, -f + 0.02, 0.52, 0.61, M['amber'], 0.01))
        for y in (f - 1.25, f - 2.25, f - 3.25):                                                                              # curtains
            parts.append(box(s * (hw - 0.12), s * (hw - 0.07), y - 0.2, y, 1.25, 1.78, M['curtain'], 0.02))
        x = s * (hw - 0.12)
        parts += wheel(wf, x, 0.33, 0.21, rim_r=0.21) + wheel(wr, x, 0.33, 0.21, rim_r=0.21)
    parts.append(box(-0.40, 0.40, f - 0.005, f + 0.035, 0.70, 0.86, M['black'], 0.01))                                       # grille
    for z in (0.725, 0.77, 0.815): parts.append(box(-0.38, 0.38, f + 0.03, f + 0.04, z, z + 0.02, M['chrome']))
    parts.append(box(-0.1, 0.1, f + 0.035, f + 0.05, 0.88, 0.94, M['chrome'], 0.008))                                         # badge
    parts.append(box(-hw - 0.02, hw + 0.02, f - 0.06, f + 0.12, 0.32, 0.50, M['black'], 0.04))                                # bumpers
    parts.append(box(-hw + 0.08, hw - 0.08, f + 0.11, f + 0.135, 0.42, 0.45, M['chrome'], 0.005))
    parts.append(box(-hw - 0.02, hw + 0.02, -f - 0.12, -f + 0.05, 0.32, 0.48, M['black'], 0.04))
    parts.append(box(-0.72, 0.72, -f - 0.014, -f + 0.01, 1.16, 1.88, M['black'], 0.02))                                       # rear window
    parts.append(box(-0.68, 0.68, -f - 0.02, -f + 0.0, 1.19, 1.85, M['glassT']))
    parts.append(box(-0.14, 0.14, -f - 0.03, -f - 0.01, 1.0, 1.06, M['chrome']))                                               # hatch handle
    parts.append(box(-0.22, 0.22, f + 0.12, f + 0.14, 0.38, 0.50, M['plate']))
    parts.append(box(-0.22, 0.22, -f - 0.05, -f - 0.03, 0.56, 0.68, M['plate']))
    for x0 in (-0.36, 0.30):                                                                                                   # wipers
        parts.append(box(x0 - 0.012, x0 + 0.34, f - 0.12, f - 0.10, 1.12, 1.14, M['black']))
    parts.append(box(-0.62, 0.62, -1.7, 1.0, 2.04, 2.08, M['steel']))                                                          # roof rack
    for y in (-1.6, -0.9, -0.2, 0.5): parts.append(box(-0.66, 0.66, y, y + 0.04, 2.08, 2.12, M['chrome']))
    for x0 in (-0.66, 0.62): parts.append(box(x0, x0 + 0.04, -1.7, 1.0, 2.08, 2.13, M['chrome']))
    parts.append(box(-0.5, 0.1, -1.4, -0.5, 2.12, 2.42, M['luggage'], 0.05))                                                   # bags on the roof
    parts.append(box(0.15, 0.55, -0.4, 0.3, 2.12, 2.32, M['luggage2'], 0.05))
    # interior: floor, driver + seat, four benches
    parts.append(box(-hw + 0.06, hw - 0.06, -f + 0.1, f - 0.25, 0.38, 0.42, M['floor']))
    parts.append(box(0.0, 0.66, f - 0.95, f - 0.55, 0.42, 0.72, M['seat'], 0.03))
    parts.append(box(0.0, 0.66, f - 1.02, f - 0.9, 0.72, 1.35, M['seat'], 0.03))
    for y in (f - 1.75, f - 2.55, f - 3.35, f - 4.1):
        parts.append(box(-hw + 0.08, hw - 0.08, y - 0.2, y + 0.24, 0.42, 0.64, M['seat'], 0.03))
        parts.append(box(-hw + 0.08, hw - 0.08, y - 0.3, y - 0.18, 0.64, 1.26, M['seat'], 0.03))
    parts.append(box(-hw + 0.08, hw - 0.08, f - 0.55, f - 0.22, 0.98, 1.06, M['black'], 0.02))                                # dashboard
    parts.append(cyl(0.17, 0.5, (0.33, f - 0.72, 1.0), M['shirt'], axis='Z', seg=14))                                          # driver
    parts.append(cyl(0.11, 0.24, (0.33, f - 0.72, 1.38), M['skin'], axis='Z', seg=14))
    parts.append(cyl(0.115, 0.06, (0.33, f - 0.72, 1.51), M['hair'], axis='Z', seg=14))
    parts.append(cyl(0.19, 0.035, (0.33, f - 0.42, 1.12), M['black'], axis='Y', seg=20))
    finish(name, parts)

# ------------------------------------------------------------ container truck (cab-over tractor + chassis)
def truck(name):
    parts = []
    hw = 1.24
    cy0, cy1 = 4.75, 6.95
    cab = [(cy1, 0.95), (cy1+0.03, 1.6), (cy1-0.05, 2.9), (cy1-0.35, 3.25), (cy0, 3.25), (cy0, 0.95)]
    parts.append(bevel(extrude(name+'Cab', cab, hw, [M['red']]), 0.08, 3))
    parts.append(box(-1.1, 1.1, cy1-0.02, cy1+0.045, 1.95, 2.85, M['glass']))
    for s in (1, -1):
        parts.append(panel([(cy1-0.25, 2.0), (cy0+0.9, 2.0), (cy0+0.9, 2.85), (cy1-0.35, 2.85)], lambda z: hw+0.006, M['glass'], s))
        parts.append(box(s*0.72, s*1.05, cy1-0.02, cy1+0.07, 1.15, 1.35, M['head'], 0.02))
        parts.append(box(s*1.24, s*1.45, cy1-0.25, cy1-0.15, 2.0, 2.6, M['black'], 0.02))  # mirrors
        parts.append(box(s*1.05, s*1.2, 2.9, 4.6, 0.9, 1.4, M['steel'], 0.04))           # tank / box
    parts.append(box(-0.95, 0.95, cy1-0.01, cy1+0.06, 1.4, 1.85, M['black'], 0.02))      # grille
    parts.append(box(-hw, hw, cy1-0.1, cy1+0.15, 0.55, 0.95, M['steel'], 0.04))          # bumper
    parts.append(box(-0.6, 0.6, cy0-0.4, cy0, 2.4, 3.1, M['black']))                     # wind deflector base
    parts.append(box(-0.5, 0.5, -7.0, cy0, 0.85, 1.12, M['black']))                      # chassis
    parts.append(box(-1.25, 1.25, -7.0, 4.55, 1.12, 1.24, M['steel']))                   # bed
    # 40 ft container with corrugated sides
    c0, c1, z0, z1, ch = -6.95, 4.45, 1.24, 3.84, 1.22
    parts.append(box(-ch, ch, c0, c1, z0, z1, M['paint']))
    y = c0 + 0.25
    while y < c1 - 0.2:
        for s in (1, -1):
            parts.append(box(s*ch, s*(ch+0.04), y, y+0.14, z0+0.06, z1-0.06, M['paint']))
        y += 0.32
    for yy in (c0, c1):
        for s in (1, -1):
            for zz in (z0, z1-0.16):
                parts.append(box(s*(ch-0.16), s*(ch+0.02), yy-0.02, yy+0.16 if yy == c0 else yy+0.02, zz, zz+0.16, M['steel']))
    parts.append(box(-ch, ch, c0-0.03, c0+0.01, z0, z1, M['steel']))                     # doors
    for xx in (-0.5, -0.2, 0.2, 0.5):
        parts.append(box(xx-0.02, xx+0.02, c0-0.06, c0-0.02, z0+0.1, z1-0.1, M['chrome']))
    for s in (1, -1):
        parts.append(box(s*0.6, s*1.0, -7.06, -7.0, 0.95, 1.1, M['tail']))
        x = s*(hw-0.2)
        for wy in (6.0, 3.6, 2.5, -4.6, -5.7):
            parts += wheel(wy, x, 0.5, 0.32, rim_r=0.3)
            if wy < 5: parts += wheel(wy, s*(hw-0.55), 0.5, 0.3, rim_r=0.3)
    finish(name, parts)

sedan('Sedan')
classic('Classic')
sedan('Taxi', L=4.25, W=1.68, taxi=True)
micro('Micro')
truck('Truck')

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_yup=True, use_selection=False)
print('exported', OUT, os.path.getsize(OUT))

if RENDER:
    os.makedirs(RENDER, exist_ok=True)
    xs = {'Sedan': -9, 'Classic': -4.5, 'Taxi': 0, 'Micro': 4.5}
    for n, x in xs.items(): bpy.data.objects[n].location.x = x
    bpy.data.objects['Truck'].location = (10, -3, 0)
    world = bpy.data.worlds.new('W'); scn.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.8, 0.84, 0.9, 1)
    sun = bpy.data.lights.new('Sun', 'SUN'); sun.energy = 3.5
    so = bpy.data.objects.new('Sun', sun); so.rotation_euler = (math.radians(50), 0, math.radians(30)); col.objects.link(so)
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=30)
    obj('Floor', bm, [mat('FloorM', '999999', 0.8)])
    cam = bpy.data.cameras.new('Cam'); cam.lens = 30
    co = bpy.data.objects.new('Cam', cam); col.objects.link(co); scn.camera = co
    scn.render.engine = 'CYCLES'; scn.cycles.samples = 32
    scn.render.resolution_x = 1400; scn.render.resolution_y = 700
    for nm, p in {'front': (6, 16, 5), 'rear': (-4, -15, 5)}.items():
        co.location = p; d = Vector((1, 0, 1)) - Vector(p)
        co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        scn.render.filepath = os.path.join(RENDER, nm + '.png'); bpy.ops.render.render(write_still=True)
