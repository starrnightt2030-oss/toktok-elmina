"""Build the Egyptian tuk-tuk (Bajaj RE style) in Blender and export a GLB.

Run:  python3 tools/build_tuk.py <out.glb> [render_dir]
Blender axes: +Y = forward, +Z = up, +X = right (glTF export turns +Y into -Z).
Object names used by the game: Body, SteerF (front fork + wheel pivot),
WheelF, WheelRL, WheelRR, Plate, Slogan, PaxSeat (empty), HeadL/HeadR, TailL/TailR.
"""
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix

OUT = sys.argv[1] if len(sys.argv) > 1 else 'tuk.glb'
RENDER = sys.argv[2] if len(sys.argv) > 2 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene
col = scn.collection

# ---------------------------------------------------------------- materials
def mat(name, color, rough=0.5, metal=0.0, emit=None, emit_str=0.0, alpha=1.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if coat:
        b.inputs['Coat Weight'].default_value = coat
        b.inputs['Coat Roughness'].default_value = 0.05
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = emit_str
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    return m

def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)

M = {
    'paint':   mat('Paint',   srgb('ffc400'), 0.25, 0.1, coat=1.0),
    'black':   mat('BlackPlastic', srgb('17181b'), 0.45, 0.0),
    'canvas':  mat('Canvas',  srgb('1c1d20'), 0.92, 0.0),
    'chrome':  mat('Chrome',  srgb('e8eaee'), 0.08, 1.0),
    'steel':   mat('Steel',   srgb('8d9399'), 0.35, 0.9),
    'rubber':  mat('Rubber',  srgb('121214'), 0.88, 0.0),
    'vinyl':   mat('Vinyl',   srgb('1a1a1d'), 0.55, 0.0),
    'mat':     mat('FloorMat', srgb('2a2b2e'), 0.95, 0.0),
    'glass':   mat('Glass',   srgb('cfe4ee'), 0.02, 0.0, alpha=0.22),
    'lens':    mat('HeadLens', srgb('fff4d6'), 0.05, 0.0, emit=srgb('fff1cc'), emit_str=3.0),
    'refl':    mat('Reflector', srgb('d8dadd'), 0.15, 1.0),
    'tail':    mat('TailLens', srgb('d4140c'), 0.15, 0.0, emit=srgb('ff2a1a'), emit_str=1.2),
    'amber':   mat('Indicator', srgb('ff9a10'), 0.15, 0.0, emit=srgb('ff9a10'), emit_str=0.6),
    'decal':   mat('Decal',   srgb('c8261f'), 0.4, 0.0),
    'rim':     mat('Rim',     srgb('b9bec4'), 0.3, 0.85),
    'seatred': mat('SeatTrim', srgb('8a1c18'), 0.6, 0.0),
    'skin':    mat('Skin',    srgb('8f6446'), 0.6, 0.0),
    'shirt':   mat('Shirt',   srgb('3f6587'), 0.8, 0.0),
    'pants':   mat('Pants',   srgb('2b2f38'), 0.8, 0.0),
    'hair':    mat('Hair',    srgb('1d1712'), 0.7, 0.0),
}

# ---------------------------------------------------------------- helpers
def link(ob, parent=None):
    col.objects.link(ob)
    if parent: ob.parent = parent
    return ob

def new_obj(name, me, m=None, parent=None):
    ob = bpy.data.objects.new(name, me)
    if m: me.materials.append(m)
    return link(ob, parent)

def add_mods(ob, bevel=0.0, seg=2, sub=0, smooth=True, solid=0.0):
    if solid:
        md = ob.modifiers.new('sol', 'SOLIDIFY'); md.thickness = solid; md.offset = 0
    if bevel:
        md = ob.modifiers.new('bev', 'BEVEL'); md.width = bevel; md.segments = seg; md.limit_method = 'ANGLE'
        md.angle_limit = math.radians(35)
    if sub:
        md = ob.modifiers.new('sub', 'SUBSURF'); md.levels = sub; md.render_levels = sub
    if smooth:
        for p in ob.data.polygons: p.use_smooth = True
    return ob

def box(name, x0, x1, y0, y1, z0, z1, m, bevel=0.0, seg=2, sub=0, parent=None):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector(((x0 + x1) / 2 + v.co.x * (x1 - x0), (y0 + y1) / 2 + v.co.y * (y1 - y0), (z0 + z1) / 2 + v.co.z * (z1 - z0)))
    bm.to_mesh(me); bm.free()
    return add_mods(new_obj(name, me, m, parent), bevel, seg, sub, smooth=bool(bevel or sub))

def shaped(name, fn, m, cuts=(4, 6, 4), bevel=0.0, seg=2, sub=2, parent=None):
    """A box subdivided into a grid; fn(u,v,w) in [-1,1]^3 -> world point."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    nx, ny, nz = cuts
    idx = {}
    def V(i, j, k):
        key = (i, j, k)
        if key not in idx:
            idx[key] = bm.verts.new(fn(-1 + 2 * i / nx, -1 + 2 * j / ny, -1 + 2 * k / nz))
        return idx[key]
    faces = []
    for j in range(ny):
        for k in range(nz):
            faces.append((V(0, j, k), V(0, j, k + 1), V(0, j + 1, k + 1), V(0, j + 1, k)))
            faces.append((V(nx, j, k), V(nx, j + 1, k), V(nx, j + 1, k + 1), V(nx, j, k + 1)))
    for i in range(nx):
        for k in range(nz):
            faces.append((V(i, 0, k), V(i + 1, 0, k), V(i + 1, 0, k + 1), V(i, 0, k + 1)))
            faces.append((V(i, ny, k), V(i, ny, k + 1), V(i + 1, ny, k + 1), V(i + 1, ny, k)))
    for i in range(nx):
        for j in range(ny):
            faces.append((V(i, j, 0), V(i, j + 1, 0), V(i + 1, j + 1, 0), V(i + 1, j, 0)))
            faces.append((V(i, j, nz), V(i + 1, j, nz), V(i + 1, j + 1, nz), V(i, j + 1, nz)))
    for f in faces: bm.faces.new(f)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    return add_mods(new_obj(name, me, m, parent), bevel, seg, sub)

def cyl(name, r, depth, loc, m, axis='Z', verts=24, r2=None, bevel=0.0, parent=None):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts, radius1=r, radius2=r if r2 is None else r2, depth=depth)
    rot = {'Z': Matrix(), 'X': Matrix.Rotation(math.pi / 2, 4, 'Y'), 'Y': Matrix.Rotation(math.pi / 2, 4, 'X')}[axis]
    bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector(loc)) @ rot, verts=bm.verts)
    bm.to_mesh(me); bm.free()
    ob = new_obj(name, me, m, parent)
    add_mods(ob, bevel, 2, 0)
    for p in ob.data.polygons: p.use_smooth = True
    ob.data.shade_auto_smooth if hasattr(ob.data, 'shade_auto_smooth') else None
    return ob

def tube(name, pts, r, m, parent=None, seg=10):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    cu.bevel_depth = r; cu.bevel_resolution = 3; cu.use_fill_caps = True
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts): sp.points[i].co = (*p, 1)
    ob = bpy.data.objects.new(name, cu); ob.data.materials.append(m); link(ob, parent)
    return ob

def smooth_tube(name, pts, r, m, parent=None):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    cu.bevel_depth = r; cu.bevel_resolution = 4; cu.use_fill_caps = True; cu.resolution_u = 10
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        bp = sp.bezier_points[i]; bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'
    ob = bpy.data.objects.new(name, cu); ob.data.materials.append(m); link(ob, parent)
    return ob

def lathe(name, profile, m, loc, axis='X', seg=32, parent=None):
    """profile: list of (radius, offset along axis)."""
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    rings = []
    for (r, a) in profile:
        ring = []
        for s in range(seg):
            t = 2 * math.pi * s / seg
            ring.append(bm.verts.new((a, r * math.cos(t), r * math.sin(t))))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for s in range(seg):
            a, b = rings[i][s], rings[i][(s + 1) % seg]
            c, d = rings[i + 1][(s + 1) % seg], rings[i + 1][s]
            bm.faces.new((a, b, c, d))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    rot = {'X': Matrix(), 'Y': Matrix.Rotation(math.pi / 2, 4, 'Z'), 'Z': Matrix.Rotation(-math.pi / 2, 4, 'Y')}[axis]
    bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector(loc)) @ rot, verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    ob = new_obj(name, me, m, parent)
    for p in ob.data.polygons: p.use_smooth = True
    return ob

def empty(name, loc, parent=None):
    e = bpy.data.objects.new(name, None); e.location = loc; link(e, parent); return e

def lerp(a, b, t): return a + (b - a) * t

# ================================================================ BODY
root = empty('TukTuk', (0, 0, 0))
body = empty('Body', (0, 0, 0), root)

# chassis + floor
box('Chassis', -0.58, 0.58, -1.18, 0.80, 0.30, 0.38, M['black'], bevel=0.02, parent=body)
box('FloorMat', -0.56, 0.56, -0.62, 0.62, 0.38, 0.40, M['mat'], parent=body)

# front cowl: tapered, sloped nose, rounded edges
def cowl(u, v, w):
    y = lerp(0.62, 1.36, (v + 1) / 2)
    z = lerp(0.40, 1.26, (w + 1) / 2)
    t = (v + 1) / 2           # 0 back .. 1 front
    h = (w + 1) / 2           # 0 bottom .. 1 top
    half = lerp(0.62, 0.50, t ** 1.6) * lerp(1.0, 0.93, h)
    x = u * half
    # nose slopes back at the top and bulges at mid height
    y -= (h ** 1.8) * 0.20 * t
    y += math.sin(h * math.pi) * 0.04 * t
    return Vector((x, y, z))
cowlo = shaped('Cowl', cowl, M['paint'], cuts=(6, 6, 6), bevel=0.0, sub=2, parent=body)

# black lower nose with the twin headlamps (Bajaj RE look)
def nose(u, v, w):
    h = (w + 1) / 2
    x = u * lerp(0.47, 0.44, h)
    z = lerp(0.62, 1.03, h)
    y = 1.345 + math.sin(h * math.pi) * 0.035 - 0.03 * (u * u) + v * 0.035 - 0.03
    return Vector((x, y, z))
shaped('Nose', nose, M['black'], cuts=(6, 1, 4), sub=2, parent=body)
for s, nm in ((-1, 'HeadL'), (1, 'HeadR')):
    x = s * 0.27
    lathe(nm + 'Bezel', [(0.0, 0.0), (0.12, 0.0), (0.135, 0.02), (0.13, 0.06), (0.11, 0.065)], M['chrome'], (x, 1.375, 0.86), axis='Y', parent=body)
    lathe(nm + 'Refl', [(0.0, 0.0), (0.105, 0.0), (0.06, 0.035), (0.0, 0.04)], M['refl'], (x, 1.38, 0.86), axis='Y', parent=body)
    lathe(nm, [(0.0, 0.0), (0.108, 0.0), (0.09, 0.025), (0.0, 0.035)], M['lens'], (x, 1.415, 0.86), axis='Y', parent=body)
# centre badge + grille slots
lathe('Badge', [(0.0, 0.0), (0.06, 0.0), (0.06, 0.012), (0.0, 0.016)], M['chrome'], (0, 1.40, 0.88), axis='Y', parent=body)
for i in range(3):
    box('Grille%d' % i, -0.12, 0.12, 1.36, 1.405, 0.70 + i * 0.05, 0.725 + i * 0.05, M['steel'], bevel=0.008, parent=body)
# yellow dash band with indicators + plate
for s in (-1, 1):
    box('Ind%d' % s, s * 0.47 - 0.07, s * 0.47 + 0.07, 1.20, 1.305, 1.12, 1.17, M['amber'], bevel=0.012, parent=body)
box('PlateF', -0.16, 0.16, 1.24, 1.315, 1.08, 1.20, M['steel'], bevel=0.005, parent=body)
# front wheel cover (fender sits on fork)
# windshield frame
for s in (-1, 1):
    tube('APillar%d' % s, [(s * 0.53, 1.12, 1.22), (s * 0.55, 1.03, 1.86)], 0.035, M['paint'], parent=body)
smooth_tube('WsTop', [(-0.56, 1.02, 1.86), (0, 1.04, 1.885), (0.56, 1.02, 1.86)], 0.04, M['black'], parent=body)
smooth_tube('WsBot', [(-0.54, 1.13, 1.22), (0, 1.17, 1.235), (0.54, 1.13, 1.22)], 0.03, M['black'], parent=body)
wsme = bpy.data.meshes.new('Windshield'); bm = bmesh.new()
pts = [(-0.52, 1.125, 1.24), (0.52, 1.125, 1.24), (0.535, 1.035, 1.84), (-0.535, 1.035, 1.84)]
bm.faces.new([bm.verts.new(p) for p in pts]); bm.to_mesh(wsme); bm.free()
ws = new_obj('Windshield', wsme, M['glass'], body)
# wiper
tube('Wiper', [(0.05, 1.11, 1.26), (-0.32, 1.06, 1.66)], 0.008, M['black'], parent=body)
# mirrors on stalks
for s in (-1, 1):
    tube('MirArm%d' % s, [(s * 0.55, 1.03, 1.80), (s * 0.70, 1.02, 1.86), (s * 0.80, 1.04, 1.74)], 0.012, M['black'], parent=body)
    lathe('Mirror%d' % s, [(0.0, 0.0), (0.085, 0.0), (0.09, 0.02), (0.07, 0.04), (0.0, 0.045)], M['black'], (s * 0.82, 1.05, 1.70), axis='Y', parent=body)
    lathe('MirGlass%d' % s, [(0.0, 0.002), (0.075, 0.002), (0.0, 0.0)], M['chrome'], (s * 0.82, 1.046, 1.70), axis='Y', parent=body)

# dashboard + steering handlebar + speedo
box('Dash', -0.50, 0.50, 0.98, 1.16, 1.12, 1.26, M['black'], bevel=0.03, parent=body)
lathe('Speedo', [(0.0, 0.0), (0.07, 0.0), (0.075, 0.03), (0.0, 0.035)], M['black'], (0, 1.02, 1.30), axis='Y', parent=body).rotation_euler = (math.radians(-60), 0, 0)
smooth_tube('Handlebar', [(-0.40, 0.70, 1.30), (-0.18, 0.80, 1.25), (0.0, 0.84, 1.22), (0.18, 0.80, 1.25), (0.40, 0.70, 1.30)], 0.018, M['chrome'], parent=body)
for s in (-1, 1):
    cyl('Grip%d' % s, 0.026, 0.13, (s * 0.44, 0.69, 1.31), M['rubber'], axis='X', verts=16, parent=body)
tube('Column', [(0, 0.84, 1.22), (0, 1.0, 0.80)], 0.03, M['black'], parent=body)

# driver seat on its pedestal
box('DrvPed', -0.30, 0.30, 0.22, 0.62, 0.40, 0.92, M['black'], bevel=0.03, parent=body)
box('DrvSeat', -0.32, 0.32, 0.18, 0.66, 0.92, 1.04, M['vinyl'], bevel=0.04, seg=3, parent=body)
box('DrvBack', -0.30, 0.30, 0.10, 0.18, 1.0, 1.36, M['vinyl'], bevel=0.035, seg=3, parent=body)

# rear tub (passenger section) with rounded corners
def tub(u, v, w):
    t = (v + 1) / 2; h = (w + 1) / 2
    y = lerp(-1.34, -0.30, t)
    z = lerp(0.38, 1.04, h)
    x = u * lerp(0.66, 0.665, h)
    y -= (1 - t) * 0.04 * (h ** 2)   # rear panel leans back slightly
    return Vector((x, y, z))
shaped('Tub', tub, M['paint'], cuts=(6, 6, 4), sub=2, parent=body)
# side skirts towards the front (step) + rear fender bulges
for s in (-1, 1):
    box('Step%d' % s, s * 0.66 - (0.06 if s > 0 else -0.06) * 0, s * 0.62, -0.30, 0.62, 0.32, 0.46, M['paint'], bevel=0.02, parent=body) if False else None
    box('Skirt%d' % s, min(s * 0.64, s * 0.60), max(s * 0.64, s * 0.60), -0.32, 0.64, 0.34, 0.48, M['paint'], bevel=0.02, parent=body)
    # louvres on the tub side (like the photo)
    for i in range(5):
        box('Louvre%d_%d' % (s, i), min(s * 0.668, s * 0.68), max(s * 0.668, s * 0.68), -0.78 + i * 0.07, -0.74 + i * 0.07, 0.56, 0.72, M['black'], bevel=0.006, parent=body)
    # decal swoosh
    smooth_tube('Swoosh%d' % s, [(s * 0.672, -1.25, 0.95), (s * 0.672, -1.05, 0.88), (s * 0.672, -0.85, 0.92)], 0.012, M['decal'], parent=body)
    smooth_tube('Swoosh2_%d' % s, [(s * 0.672, -1.22, 0.90), (s * 0.672, -1.02, 0.83), (s * 0.672, -0.86, 0.87)], 0.008, M['black'], parent=body)
    # front-cowl decal line
    smooth_tube('CowlLine%d' % s, [(s * 0.615, 0.70, 0.62), (s * 0.60, 0.95, 0.80), (s * 0.57, 1.20, 1.02)], 0.01, M['decal'], parent=body)
# chrome trim line along the tub
for s in (-1, 1):
    tube('Trim%d' % s, [(s * 0.672, -1.30, 1.02), (s * 0.672, -0.32, 1.02)], 0.012, M['chrome'], parent=body)
tube('TrimBack', [(-0.66, -1.355, 1.02), (0.66, -1.355, 1.02)], 0.012, M['chrome'], parent=body)

# passenger bench + backrest (rear canvas wall) + chrome grab bar
box('PaxBase', -0.62, 0.62, -1.28, -0.66, 1.0, 1.06, M['black'], parent=body)
box('PaxSeat', -0.62, 0.62, -1.26, -0.66, 1.04, 1.16, M['vinyl'], bevel=0.045, seg=3, parent=body)
box('PaxBack', -0.62, 0.62, -1.32, -1.20, 1.14, 1.58, M['vinyl'], bevel=0.04, seg=3, parent=body)
for i in range(3):
    box('PaxPip%d' % i, -0.60, 0.60, -1.205, -1.195, 1.22 + i * 0.12, 1.235 + i * 0.12, M['seatred'], parent=body)
smooth_tube('GrabBar', [(-0.56, -0.20, 1.20), (-0.56, -0.12, 1.40), (0.0, -0.10, 1.42), (0.56, -0.12, 1.40), (0.56, -0.20, 1.20)], 0.018, M['chrome'], parent=body)
box('DriverPanel', -0.60, 0.60, -0.16, -0.08, 1.04, 1.40, M['black'], bevel=0.02, parent=body)

# ------------------------------------------------------------ roof + canvas
def roof(u, v, w):
    t = (v + 1) / 2; h = (w + 1) / 2
    y = lerp(-1.40, 1.12, t)
    x = u * 0.74
    crown = 0.07 * (1 - u * u)
    z = 1.84 + h * 0.06 + crown
    # front lip turns down over the windshield
    if t > 0.95: z -= (t - 0.95) / 0.05 * 0.06
    return Vector((x, y, z))
shaped('Roof', roof, M['canvas'], cuts=(8, 10, 1), sub=2, parent=body)
# rolled canvas edges
for s in (-1, 1):
    tube('RoofEdge%d' % s, [(s * 0.74, -1.38, 1.87), (s * 0.74, 1.10, 1.87)], 0.03, M['canvas'], parent=body)
# rear canvas cabin: back wall with window + side walls of the passenger part
def canvas_panel(name, pts, hole=None):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    vs = [bm.verts.new(p) for p in pts]; bm.faces.new(vs)
    bm.to_mesh(me); bm.free()
    ob = new_obj(name, me, M['canvas'], body)
    add_mods(ob, solid=0.015, smooth=False)
    return ob
canvas_panel('CanvasBack', [(-0.70, -1.39, 1.05), (0.70, -1.39, 1.05), (0.74, -1.40, 1.88), (-0.74, -1.40, 1.88)])
box('BackWinFrame', -0.45, 0.45, -1.418, -1.408, 1.33, 1.73, M['black'], parent=body)
box('BackWindow', -0.42, 0.42, -1.428, -1.42, 1.36, 1.70, mat('Tint', srgb('3d5566'), 0.05, 0.3), parent=body)
for s in (-1, 1):
    canvas_panel('CanvasSide%d' % s, [(s * 0.735, -1.39, 1.03), (s * 0.735, -0.62, 1.03), (s * 0.74, -0.62, 1.88), (s * 0.74, -1.40, 1.88)])
    box('SideWin%d' % s, min(s * 0.745, s * 0.75), max(s * 0.745, s * 0.75), -1.16, -0.82, 1.40, 1.70, M['glass'], parent=body)
    # pillars
    tube('MidPillar%d' % s, [(s * 0.66, -0.10, 1.02), (s * 0.73, -0.10, 1.88)], 0.03, M['black'], parent=body)
    tube('RearPillar%d' % s, [(s * 0.68, -0.62, 1.03), (s * 0.735, -0.62, 1.88)], 0.03, M['black'], parent=body)
    # grab handles hanging from the roof rail (yellow triangles in the photo)
    tube('Rail%d' % s, [(s * 0.62, -1.30, 1.82), (s * 0.62, 0.60, 1.82)], 0.012, M['steel'], parent=body)
    for j, y in enumerate((-0.95, -0.45, 0.15)):
        tube('Strap%d_%d' % (s, j), [(s * 0.62, y, 1.82), (s * 0.62, y, 1.70)], 0.01, M['black'], parent=body)
        tube('Handle%d_%d' % (s, j), [(s * 0.62, y - 0.06, 1.62), (s * 0.62, y + 0.06, 1.62), (s * 0.62, y, 1.70), (s * 0.62, y - 0.06, 1.62)], 0.012, M['paint'], parent=body)
# fringe (instanced later in game is cheaper, but a few here look good in previews)
cols = [srgb(c) for c in ('f2b705', '2a9d8f', 'e63946', 'ffffff', '7b2cbf')]
fm = [mat('Fringe%d' % i, c, 0.6) for i, c in enumerate(cols)]
for i in range(15):
    x = -0.63 + i * 0.09
    box('Fringe%d' % i, x - 0.02, x + 0.02, 1.07, 1.085, 1.74, 1.84, fm[i % 5], parent=body)
# evil-eye charm
tube('CharmStr', [(0, 0.98, 1.84), (0, 0.98, 1.64)], 0.004, M['black'], parent=body)
lathe('Charm', [(0.0, -0.03), (0.035, -0.025), (0.04, 0.0), (0.035, 0.025), (0.0, 0.03)], mat('EvilEye', srgb('1f6fd0'), 0.2, 0.1), (0, 0.98, 1.61), axis='Y', parent=body)

# rear lights, plate, slogan board, mud flaps
for s, nm in ((-1, 'TailL'), (1, 'TailR')):
    box(nm, s * 0.52 - 0.07, s * 0.52 + 0.07, -1.395, -1.36, 0.86, 0.98, M['tail'], bevel=0.015, parent=body)
    box(nm + 'Ind', s * 0.52 - 0.07, s * 0.52 + 0.07, -1.39, -1.36, 0.80, 0.85, M['amber'], bevel=0.01, parent=body)
    box('Flap%d' % s, s * 0.60 - 0.12, s * 0.60 + 0.12, -1.10, -1.085, 0.10, 0.42, M['rubber'], parent=body)
box('PlateR', -0.17, 0.17, -1.41, -1.385, 0.56, 0.70, M['steel'], bevel=0.005, parent=body)
box('Slogan', -0.40, 0.40, -1.40, -1.385, 0.74, 0.84, M['black'], parent=body)
tube('Exhaust', [(0.42, -0.70, 0.30), (0.45, -1.20, 0.30), (0.46, -1.42, 0.33)], 0.035, M['steel'], parent=body)
lathe('ExhaustTip', [(0.04, 0.0), (0.045, 0.0), (0.045, 0.08), (0.04, 0.08)], M['chrome'], (0.46, -1.44, 0.33), axis='Y', parent=body)

# driver
drv = empty('Driver', (0, 0.40, 1.04), body)
cyl('DrvTorso', 0.17, 0.5, (0, 0.0, 0.32), M['shirt'], verts=16, parent=drv).scale = (1.0, 0.7, 1.0)
lathe('DrvHead', [(0.0, -0.13), (0.09, -0.11), (0.115, -0.03), (0.11, 0.05), (0.07, 0.11), (0.0, 0.125)], M['skin'], (0, 0.0, 0.72), axis='Z', parent=drv)
lathe('DrvHair', [(0.0, 0.02), (0.11, 0.03), (0.105, 0.08), (0.06, 0.12), (0.0, 0.13)], M['hair'], (0, -0.01, 0.73), axis='Z', parent=drv)
for s in (-1, 1):
    tube('DrvArm%d' % s, [(s * 0.17, 0.0, 0.52), (s * 0.24, 0.16, 0.32), (s * 0.40, 0.29, 0.27)], 0.045, M['shirt'], parent=drv)
    tube('DrvLeg%d' % s, [(s * 0.10, -0.02, 0.06), (s * 0.12, 0.30, 0.06), (s * 0.13, 0.36, -0.55)], 0.06, M['pants'], parent=drv)
empty('PaxSeatPt', (0, -0.95, 1.16), body)

# ---------------------------------------------------------------- wheels
def wheel(name, loc, parent):
    w = empty(name, loc, parent)
    r = 0.25
    # tyre: lathe a rounded profile around X
    prof = []
    for k in range(0, 13):
        a = math.pi * k / 12
        prof.append((0.165 + 0.085 * math.sin(a), -0.085 * math.cos(a)))
    lathe(name + 'Tyre', prof, M['rubber'], (0, 0, 0), axis='X', seg=40, parent=w)
    # tread blocks
    for k in range(28):
        a = 2 * math.pi * k / 28
        b = box(name + 'Tr%d' % k, -0.07, 0.07, -0.022, 0.022, r - 0.006, r + 0.012, M['rubber'], parent=w)
        b.rotation_euler = (a, 0, 0)
    lathe(name + 'Rim', [(0.0, -0.06), (0.15, -0.06), (0.165, -0.05), (0.165, 0.05), (0.15, 0.06), (0.0, 0.06)], M['rim'], (0, 0, 0), axis='X', seg=32, parent=w)
    lathe(name + 'Hub', [(0.0, -0.08), (0.06, -0.08), (0.06, 0.08), (0.0, 0.08)], M['steel'], (0, 0, 0), axis='X', seg=16, parent=w)
    for k in range(5):
        a = 2 * math.pi * k / 5
        cyl(name + 'Nut%d' % k, 0.012, 0.03, (0.07, 0.04 * math.cos(a), 0.04 * math.sin(a)), M['chrome'], axis='X', verts=6, parent=w)
    return w

steer = empty('SteerF', (0, 1.05, 0.0), body)
wheel('WheelF', (0, 0, 0.25), steer)
# fork + fender on the steering pivot
for s in (-1, 1):
    tube('Fork%d' % s, [(s * 0.10, 0, 0.25), (s * 0.10, -0.06, 0.62)], 0.03, M['chrome'], parent=steer)
    tube('Shock%d' % s, [(s * 0.10, -0.06, 0.62), (s * 0.09, -0.10, 0.80)], 0.045, M['black'], parent=steer)
def fender(u, v, w):
    a = lerp(math.radians(10), math.radians(150), (v + 1) / 2)
    r = 0.30 + (w + 1) / 2 * 0.012
    return Vector((u * 0.13, math.cos(a) * r, 0.25 + math.sin(a) * r))
shaped('FenderF', fender, M['black'], cuts=(2, 10, 1), sub=1, parent=steer)

wheel('WheelRL', (-0.62, -0.88, 0.25), body)
wheel('WheelRR', (0.62, -0.88, 0.25), body)
for s in (-1, 1):
    def rf(u, v, w, s=s):
        a = lerp(math.radians(-10), math.radians(190), (v + 1) / 2)
        r = 0.31 + (w + 1) / 2 * 0.012
        return Vector((s * 0.62 + u * 0.13, -0.88 + math.cos(a) * r, 0.25 + math.sin(a) * r))
    shaped('FenderR%d' % s, rf, M['black'], cuts=(2, 10, 1), sub=1, parent=body)
tube('Axle', [(-0.55, -0.88, 0.25), (0.55, -0.88, 0.25)], 0.03, M['steel'], parent=body)

# ---------------------------------------------------------------- export
# convert curves to meshes so the exporter keeps them and bake modifiers
bpy.context.view_layer.update()
for ob in list(col.objects):
    if ob.type == 'CURVE':
        bpy.context.view_layer.objects.active = ob
        for o in bpy.context.selected_objects: o.select_set(False)
        ob.select_set(True)
        bpy.ops.object.convert(target='MESH')

# bake modifiers on every mesh, then merge meshes per moving part (fewer draw calls in the game)
for o in bpy.context.selected_objects: o.select_set(False)
meshes = [o for o in col.objects if o.type == 'MESH']
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.convert(target='MESH')
GROUPS = ['WheelF', 'WheelRL', 'WheelRR', 'SteerF', 'Driver', 'Body']
def group_of(o):
    p = o.parent
    while p is not None:
        if p.name in GROUPS: return p
        p = p.parent
    return None
buckets = {}
for o in [o for o in col.objects if o.type == 'MESH']:
    g = group_of(o)
    if g is not None: buckets.setdefault(g.name, []).append(o)
for gname, obs in buckets.items():
    g = bpy.data.objects[gname]
    for o in bpy.context.selected_objects: o.select_set(False)
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    j = bpy.context.view_layer.objects.active
    mw = j.matrix_world.copy(); j.parent = g; j.matrix_world = mw
    j.name = gname + 'Mesh'
print('merged', {k: len(v) for k, v in buckets.items()})

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_yup=True,
                          export_materials='EXPORT', use_selection=False)
print('exported', OUT, os.path.getsize(OUT))

# ---------------------------------------------------------------- previews
if RENDER:
    os.makedirs(RENDER, exist_ok=True)
    world = bpy.data.worlds.new('W'); scn.world = world; world.use_nodes = True
    bg = world.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.82, 0.85, 0.9, 1); bg.inputs['Strength'].default_value = 0.9
    sun = bpy.data.lights.new('Sun', 'SUN'); sun.energy = 3.5
    so = bpy.data.objects.new('Sun', sun); so.rotation_euler = (math.radians(50), 0, math.radians(30)); col.objects.link(so)
    pm = bpy.data.meshes.new('Floor'); bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=8); bm.to_mesh(pm); bm.free()
    fl = new_obj('Floor', pm, mat('FloorM', (0.6, 0.6, 0.6), 0.8))
    cam = bpy.data.cameras.new('Cam'); cam.lens = 45
    co = bpy.data.objects.new('Cam', cam); col.objects.link(co); scn.camera = co
    scn.render.engine = 'CYCLES'; scn.cycles.samples = 48; scn.cycles.device = 'CPU'
    scn.render.resolution_x = 900; scn.render.resolution_y = 700
    views = {'front3q': (3.2, 3.6, 1.9), 'side': (-4.6, 0.0, 1.2), 'rear3q': (-2.8, -3.8, 2.0), 'front': (0.0, 5.0, 1.2)}
    for nm, p in views.items():
        co.location = p
        d = Vector((0, 0, 0.95)) - Vector(p)
        co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        scn.render.filepath = os.path.join(RENDER, nm + '.png')
        bpy.ops.render.render(write_still=True)
    print('rendered')
