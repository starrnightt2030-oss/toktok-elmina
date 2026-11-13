"""Intro v2 plates: high-quality stills rendered in Blender (Cycles) for the 2.5D intro film.

Run:  python3 tools/intro/build_intro_plates.py OUT_DIR [harbor|hero|all] [WIDTH HEIGHT SAMPLES]
The look follows the reference mood (golden-hour harbour, cranes, a rusty bollard with rope, wet reflective quay, the hero tuk
with its lights on). Places are generic: nothing here is a surveyed position in the Port of Alexandria.
The tuk is the project's own model (public/models/tuk.glb). The logo is NOT baked in: the game lays the official logo over
the film so it stays sharp at every screen size.
Blender: +Z up, quay land is y < 0, the sea is y > 0 (north), the sun sets over the sea ahead of the camera.
"""
import bpy, bmesh, math, sys, os, random
from mathutils import Vector, Euler

OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/plates'
WHICH = sys.argv[2] if len(sys.argv) > 2 else 'all'
W = int(sys.argv[3]) if len(sys.argv) > 3 else 1920
H = int(sys.argv[4]) if len(sys.argv) > 4 else 1080
SAMPLES = int(sys.argv[5]) if len(sys.argv) > 5 else 48
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
os.makedirs(OUT, exist_ok=True)
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene; col = scn.collection

def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + .055) / 1.055) ** 2.4 if x > .04045 else x / 12.92 for x in c)

def mat(name, hexc, rough=.6, metal=0, emit=0, emit_col=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*srgb(hexc), 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit: b.inputs['Emission Color'].default_value = (*srgb(emit_col or hexc), 1); b.inputs['Emission Strength'].default_value = emit
    return m

def noisy(name, hexa, hexb, rough=.8, scale=6, bump=.25, metal=0):
    """Two-tone material broken up with noise (concrete, rust, weathered paint)."""
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord'); nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = 8
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color = (*srgb(hexa), 1); ramp.color_ramp.elements[1].color = (*srgb(hexb), 1)
    ramp.color_ramp.elements[0].position = .35; ramp.color_ramp.elements[1].position = .7
    nt.links.new(nz.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = bump; nt.links.new(nz.outputs['Fac'], bp.inputs['Height']); nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    return m

def obj(name, bm, m):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); col.objects.link(o)
    if m: me.materials.append(m)
    return o

def box(c, s, m, name='box', rot=0):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts: v.co = Vector((v.co.x * s[0], v.co.y * s[1], v.co.z * s[2]))
    o = obj(name, bm, m); o.location = c; o.rotation_euler = (0, 0, rot); return o

def cyl(c, r, h, m, seg=24, r2=None, name='cyl'):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    o = obj(name, bm, m); o.location = c
    for p in o.data.polygons: p.use_smooth = True
    return o

def torus(c, R, r, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=40, minor_segments=10, location=c, rotation=rot)
    o = bpy.context.active_object; o.data.materials.append(m)
    for p in o.data.polygons: p.use_smooth = True
    return o

# ---------------------------------------------------------------- sky, sun, clouds
world = bpy.data.worlds.new('W'); scn.world = world; world.use_nodes = True; nt = world.node_tree
sky = nt.nodes.new('ShaderNodeTexSky'); sky.sky_type = 'NISHITA' if 'NISHITA' in [i.identifier for i in sky.bl_rna.properties['sky_type'].enum_items] else sky.sky_type
SUN_EL, SUN_AZ = math.radians(3.2), math.radians(-12)    # low over the sea, a little west of straight ahead
for k, v in (('sun_elevation', SUN_EL), ('sun_rotation', SUN_AZ), ('altitude', 40), ('air_density', 2.2), ('dust_density', 3.2), ('aerosol_density', 3.2), ('ozone_density', 1.0), ('sun_size', math.radians(1.6)), ('sun_intensity', .35)):
    try: setattr(sky, k, v)
    except Exception as e: print('sky', k, e)
bg = nt.nodes['Background']; bg.inputs['Strength'].default_value = .32
nt.links.new(sky.outputs['Color'], bg.inputs['Color'])

sun_dir = Vector((math.sin(SUN_AZ) * math.cos(SUN_EL), math.cos(SUN_AZ) * math.cos(SUN_EL), math.sin(SUN_EL)))
sunl = bpy.data.lights.new('Sun', 'SUN'); sunl.energy = 3.2; sunl.color = srgb('ffb066'); sunl.angle = math.radians(1.2)
so = bpy.data.objects.new('Sun', sunl); col.objects.link(so); so.rotation_euler = (-sun_dir).to_track_quat('-Z', 'Y').to_euler()
fill = bpy.data.lights.new('Fill', 'SUN'); fill.energy = .35; fill.color = srgb('8f7cff')
fo = bpy.data.objects.new('Fill', fill); col.objects.link(fo); fo.rotation_euler = Euler((math.radians(55), 0, math.radians(200)))

# painted cloud layer: a big plane high up with noise alpha, lit warm from below by the sun
cm = bpy.data.materials.new('Clouds'); cm.use_nodes = True; c_nt = cm.node_tree; cb = c_nt.nodes['Principled BSDF']
tc = c_nt.nodes.new('ShaderNodeTexCoord'); mp = c_nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1, 2.4, 1)
nz = c_nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 3.2; nz.inputs['Detail'].default_value = 10; nz.inputs['Roughness'].default_value = .62
c_nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); c_nt.links.new(mp.outputs['Vector'], nz.inputs['Vector'])
rp = c_nt.nodes.new('ShaderNodeValToRGB'); rp.color_ramp.elements[0].position = .52; rp.color_ramp.elements[1].position = .74
c_nt.links.new(nz.outputs['Fac'], rp.inputs['Fac'])
cb.inputs['Base Color'].default_value = (*srgb('ffb48a'), 1); cb.inputs['Roughness'].default_value = 1
cb.inputs['Emission Color'].default_value = (*srgb('ff9a6a'), 1); cb.inputs['Emission Strength'].default_value = .9
c_nt.links.new(rp.outputs['Color'], cb.inputs['Alpha'])
try: cm.surface_render_method = 'BLENDED'
except Exception: pass
bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1); cl = obj('Clouds', bm, cm); cl.scale = (5000, 5000, 1); cl.location = (0, 2500, 260)
cl.visible_shadow = False

# ---------------------------------------------------------------- sea (ocean modifier) and quay
water = bpy.data.materials.new('Water'); water.use_nodes = True; wb = water.node_tree.nodes['Principled BSDF']
wb.inputs['Base Color'].default_value = (*srgb('0a2433'), 1); wb.inputs['Roughness'].default_value = .045; wb.inputs['IOR'].default_value = 1.33
try: wb.inputs['Specular IOR Level'].default_value = .9
except Exception: pass
bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, -1.4)); sea = bpy.context.active_object; sea.data.materials.append(water)
oc = sea.modifiers.new('Ocean', 'OCEAN'); oc.geometry_mode = 'GENERATE'; oc.size = 1.0; oc.spatial_size = 60; oc.repeat_x = 14; oc.repeat_y = 14; oc.resolution = 11
oc.wave_scale = .42; oc.choppiness = .8; oc.wind_velocity = 9; oc.time = 3.0
sea.location = (-420, -2, -1.4)
for p in sea.data.polygons: p.use_smooth = True

concrete = noisy('Concrete', '6f6760', 'a39a8f', rough=.82, scale=2.4, bump=.35)
quay = box((0, -300, -.9), (3000, 600, 1.8), concrete, 'Quay')                    # top at z=0, edge at y=0
edge = box((0, -.15, .06), (3000, .3, .12), mat('Kerb', 'e8b923', .5), 'Kerb')       # yellow edge
wall = box((0, .05, -.95), (3000, .1, 1.7), noisy('Wall', '4b443e', '6d655c', .9, 3, .4), 'QuayWall')

# ---------------------------------------------------------------- port: cranes, containers, ships, lighthouse, skyline
yellow = noisy('CraneY', 'd99a1e', 'f2b632', .55, 1.2, .1, .2); blue = noisy('CraneB', '1d4f86', '2f6fb0', .55, 1.2, .1, .2)
steel = mat('Steel', '50565c', .4, .7); white = mat('White', 'e9e5dc', .45)
def crane(x, y, m, rot=0):
    """STS container crane: portal legs on the quay, boom out over the water."""
    g = []
    for dx in (-7, 7):
        for dy in (-7, 7): g.append(box((x + dx, y + dy, 18), (1.2, 1.2, 36), m))
    g += [box((x, y - 7, 36), (16, 1.6, 2), m), box((x, y + 7, 36), (16, 1.6, 2), m), box((x - 7, y, 36), (1.6, 16, 2), m), box((x + 7, y, 36), (1.6, 16, 2), m)]
    g.append(box((x, y + 18, 44), (5, 70, 2.6), m))            # boom over the sea
    g.append(box((x, y + 4, 52), (3, 3, 18), m))               # A-frame
    g.append(box((x, y + 12, 41), (4, 4, 4), steel))           # trolley
    g.append(box((x, y - 3, 39), (6, 9, 5), white))             # machinery house
    for k in range(2):                                            # stays
        a = Vector((x, y + 4, 61)); b = Vector((x, y + 50 - k * 30, 45)); d = b - a
        st = box(((a + b) / 2), (.35, .35, d.length), steel); st.rotation_euler = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    return g
CONT = ['c0392b', '2e5e8c', 'd6802b', '3b7a4a', '8a8f94', 'c9a227', '1f4e5f', '7a3b5a', 'e0ddd5']
cmats = [noisy('Cont' + c, c, c, .6, 3, .15) for c in CONT]
def stack(x0, y0, nx, ny, nz, rot=0):
    for i in range(nx):
        for j in range(ny):
            for k in range(random.randint(1, nz)):
                box((x0 + i * 6.3, y0 + j * 2.6, 1.3 + k * 2.6), (6.1, 2.45, 2.55), random.choice(cmats))
def ship(x, y, L, B, hull='7d2a22', top='22374a'):
    hm = noisy('Hull' + hull, hull, '3a1612', .5, 1.5, .2, .2); tm = mat('Top' + top, top, .45, .2)
    box((x, y, -1.2), (L, B, 8), hm); box((x, y, 4), (L, B, 3), tm)
    box((x - L / 2 + 10, y, 11), (12, B * .9, 12), white); box((x - L / 2 + 10, y, 18.5), (6, B * .6, 3), mat('Funnel', 'c9302a', .4))
    for i in range(int((L - 30) / 6.4)):
        for k in range(random.randint(1, 4)): box((x - L / 2 + 22 + i * 6.4, y, 6.8 + k * 2.6), (6.1, B * .85, 2.55), random.choice(cmats))

# ---------------------------------------------------------------- the bollard with rope (shot A foreground)
rust = noisy('Rust', '4a2a1c', '8a4e2c', .7, 9, .6, .35); rope_m = noisy('Rope', '6b5034', 'a07a4e', .9, 30, .5)
def bollard(x, y):
    cyl((x, y, .32), .3, .64, rust, 28); cyl((x, y, .7), .44, .14, rust, 28); cyl((x, y, .79), .32, .06, rust, 28); cyl((x, y, .05), .6, .1, noisy('Base', '3d342e', '5a4d42', .8, 6, .3), 28)
    for k, (z, R) in enumerate(((.12, .58), (.22, .66), (.32, .55), (.42, .62))): torus((x + .03 * k, y - .02 * k, z), R, .055, rope_m, (0, 0, k * .4))
    torus((x, y, .5), .36, .05, rope_m)
    for i in range(10):    # rope trailing off over the edge
        t = i / 9; torus((x + .4 + t * 1.6, y + .3 + t * .4, .06 + t * .02), .12, .05, rope_m, (math.pi / 2, 0, .2))

# ---------------------------------------------------------------- wet patches (hero shot)
wet = mat('Wet', '2a2a2e', .06, .0)
def puddle(x, y, a, b, r):
    bm = bmesh.new(); bmesh.ops.create_circle(bm, cap_ends=True, segments=40, radius=1)
    for v in bm.verts: n = 1 + .18 * math.sin(v.co.x * 5 + v.co.y * 3); v.co = Vector((v.co.x * a * n, v.co.y * b * n, 0))
    o = obj('Puddle', bm, wet); o.location = (x, y, .012); o.rotation_euler = (0, 0, r)

# world layout
for i, x in enumerate((-48, -98, -150, -205)): crane(x, -14, yellow if i % 2 == 0 else blue)
stack(-130, -45, 12, 5, 4); stack(-260, -50, 8, 6, 3); stack(-70, -60, 5, 4, 3)
ship(-200, 60, 190, 28); ship(-420, 900, 150, 24, '9a2a22', '1b1d22'); ship(380, 700, 130, 20, '3a4a58', '2f3a46')
# lighthouse + fort on a breakwater far to the west
bw = box((-900, 520, -.2), (900, 14, 3), concrete, 'Breakwater')
cyl((-700, 520, 14), 3.4, 28, white, 32, 2.4); cyl((-700, 520, 29), 2.6, 2.4, mat('Lamp', 'fff1c8', .2, 0, 6), 24); cyl((-700, 520, 31.5), 3, 1.2, mat('LhRed', 'b8231b', .4), 32, .3)
for z in (6, 16, 24): cyl((-700, 520, z), 3.42 - z * .035, 1.6, mat('Band', 'b8231b', .4), 32)
fort = noisy('Fort', 'cdb48a', 'e4d1a6', .85, .5, .2); box((-1050, 560, 9), (110, 60, 18), fort); box((-1050, 560, 22), (36, 36, 12), fort)
# distant city skyline silhouettes
for i in range(60):
    x = -1600 + i * 55 + random.uniform(-15, 15); h = random.uniform(14, 48)
    box((x, -900 + random.uniform(-60, 60), h / 2), (random.uniform(25, 45), 30, h), noisy('Bld%d' % (i % 5), ['b8a48e', 'c8b59c', 'a99787', 'd6c3a6', '9d8b7c'][i % 5], 'efe0c4', .9, .2, .1))

# ---------------------------------------------------------------- gulls (simple swept wings)
gullm = mat('Gull', 'f2eee8', .6)
def gull(x, y, z, s, flap):
    bm = bmesh.new()
    pts = [(-1, .1, flap), (-.45, 0, .05), (0, .15, 0), (.45, 0, .05), (1, .1, flap), (.45, -.15, 0), (0, -.25, -.02), (-.45, -.15, 0)]
    vs = [bm.verts.new(Vector(p) * s) for p in pts]; bm.faces.new(vs)
    o = obj('Gull', bm, gullm); o.location = (x, y, z); o.rotation_euler = (0, random.uniform(-.2, .2), random.uniform(0, 6.28))

# ---------------------------------------------------------------- the project's tuk
def load_tuk(x, y, rotz):
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'public/models/tuk.glb'))
    root = [o for o in bpy.context.selected_objects if o.parent is None][0]
    root.location = (x, y, 0); root.rotation_mode = 'XYZ'; print('tukroot', root.name, tuple(root.rotation_euler)); root.rotation_euler = (math.pi / 2, 0, rotz) if abs(root.rotation_euler.x) > .1 else (0, 0, rotz)
    for m in bpy.data.materials:
        if m.name.startswith('HeadLens') and m.use_nodes:
            b = m.node_tree.nodes.get('Principled BSDF')
            if b: b.inputs['Emission Color'].default_value = (1, .93, .78, 1); b.inputs['Emission Strength'].default_value = 40
        if m.name.startswith('Paint') and m.use_nodes:
            b = m.node_tree.nodes.get('Principled BSDF')
            if b: b.inputs['Base Color'].default_value = (*srgb('f2b705'), 1); b.inputs['Roughness'].default_value = .22
    return root

def headlights(x, y, rotz):
    for dx in (-.34, .34):
        l = bpy.data.lights.new('Head', 'SPOT'); l.energy = 900; l.spot_size = math.radians(55); l.spot_blend = .6; l.color = srgb('fff1d0')
        o = bpy.data.objects.new('Head', l); col.objects.link(o)
        f = Vector((math.sin(rotz) * -1, math.cos(rotz), 0)); r = Vector((math.cos(rotz), math.sin(rotz), 0))
        o.location = Vector((x, y, .95)) + f * 1.45 + r * dx; o.rotation_euler = (f + Vector((0, 0, -.18))).to_track_quat('-Z', 'Y').to_euler()

# ---------------------------------------------------------------- render setup
scn.render.engine = 'CYCLES'; scn.cycles.samples = SAMPLES; scn.cycles.use_denoising = True
try: scn.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception: pass
scn.cycles.max_bounces = 4; scn.cycles.glossy_bounces = 3; scn.cycles.transmission_bounces = 2; scn.cycles.caustics_reflective = False; scn.cycles.caustics_refractive = False
scn.render.resolution_x = W; scn.render.resolution_y = H; scn.render.film_transparent = False
scn.view_settings.view_transform = 'AgX' if 'AgX' in [i.identifier for i in scn.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Filmic'
try: scn.view_settings.look = 'AgX - Punchy'
except Exception: pass
scn.view_settings.exposure = -.55

cam_d = bpy.data.cameras.new('Cam'); cam_d.lens = 32; cam_d.sensor_width = 36
cam = bpy.data.objects.new('Cam', cam_d); col.objects.link(cam); scn.camera = cam
def aim(loc, target, lens=32, dof=None):
    cam.location = loc; cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); cam_d.lens = lens
    cam_d.dof.use_dof = dof is not None
    if dof: cam_d.dof.focus_distance = dof[0]; cam_d.dof.aperture_fstop = dof[1]

def render(name):
    scn.render.filepath = os.path.join(OUT, name + '.png'); bpy.ops.render.render(write_still=True); print('rendered', name)

# ---------------------------------------------------------------- shots
# stills: WHICH = harbor | hero | all          film: WHICH = anim:<shot>  (frames go to OUT/<shot>/####.png)
FPS = 24
def key_cam(a, b, ta, tb, lens=(26, 26), dof=None, n=0):
    """Camera moves from pose a to pose b over n frames with ease-in-out, aimed at target ta -> tb."""
    tgt = bpy.data.objects.new('Tgt', None); col.objects.link(tgt)
    con = cam.constraints.new('TRACK_TO'); con.target = tgt; con.track_axis = 'TRACK_NEGATIVE_Z'; con.up_axis = 'UP_Y'
    cam_d.dof.use_dof = dof is not None
    if dof: cam_d.dof.focus_object = dof[0]; cam_d.dof.aperture_fstop = dof[1]
    for f, (p, t, l) in ((1, (a, ta, lens[0])), (n, (b, tb, lens[1]))):
        cam.location = p; tgt.location = t; cam_d.lens = l
        cam.keyframe_insert('location', frame=f); tgt.keyframe_insert('location', frame=f); cam_d.keyframe_insert('lens', frame=f)
    scn.frame_start = 1; scn.frame_end = n
    return tgt
def anim_common(n):
    oc.time = 3.0; oc.keyframe_insert('time', frame=1); oc.time = 3.0 + n / FPS * 1.0; oc.keyframe_insert('time', frame=n)
    for fc in (sea.animation_data.action.fcurves if hasattr(sea.animation_data.action, 'fcurves') else []):
        for k in fc.keyframe_points: k.interpolation = 'LINEAR'
    for g in [o for o in bpy.data.objects if o.name.startswith('Gull')]:
        d = Vector((random.uniform(-1, 1), random.uniform(-1, 1), 0)).normalized() * random.uniform(6, 12) * n / FPS
        g.keyframe_insert('location', frame=1); g.location += d; g.keyframe_insert('location', frame=n)
def render_anim(name):
    os.makedirs(os.path.join(OUT, name), exist_ok=True)
    scn.render.fps = FPS; scn.render.filepath = os.path.join(OUT, name, '')
    scn.render.image_settings.file_format = 'PNG'; scn.render.use_persistent_data = False; scn.render.use_overwrite = False; scn.render.use_placeholder = True; scn.frame_step = int(os.environ.get('STEP', '1')); scn.frame_end = min(scn.frame_end, int(os.environ.get('END', '9999'))); scn.frame_start = int(os.environ.get('START', '1'))
    bpy.ops.render.render(animation=True); print('rendered', name)

if WHICH in ('harbor', 'all') or WHICH == 'anim:harbor':
    bollard(5.2, -1.15)
    for i in range(9): gull(random.uniform(-70, 40), random.uniform(40, 200), random.uniform(10, 36), random.uniform(.7, 1.2), random.uniform(.15, .45))
    if WHICH == 'anim:harbor':
        n = round(3.8 * FPS); foc = bpy.data.objects.new('Foc', None); col.objects.link(foc); foc.location = (5.2, -1.15, .6)
        key_cam((10.2, -5.9, 1.3), (8.1, -5.3, 1.55), (-34, 62, 7.5), (-41, 60, 8.5), (24, 25), (foc, 5.6), n)
        anim_common(n); render_anim('harbor')
    else:
        aim((8, -4.6, 1.45), (-40, 60, 9), 24, dof=(4.0, 5.6)); render('harbor')
if WHICH in ('hero', 'all') or WHICH in ('anim:hero', 'anim:close'):
    for o in [o for o in bpy.data.objects if o.name.startswith(('Gull', 'cyl', 'Torus')) and o.location.z < 2 and abs(o.location.x - 5.2) < 4 and abs(o.location.y + 1.15) < 4]: bpy.data.objects.remove(o)
    tx, ty, tr = -22, -4.2, math.radians(float(os.environ.get('TUKROT', '218')))
    load_tuk(tx, ty, tr); headlights(tx, ty, tr)
    key = bpy.data.lights.new('Key', 'AREA'); key.energy = 2600; key.size = 6; key.color = srgb('ffb27a')
    ko = bpy.data.objects.new('Key', key); col.objects.link(ko); ko.location = (tx - 7, ty - 9, 5); ko.rotation_euler = (Vector((tx, ty, 1)) - ko.location).to_track_quat('-Z', 'Y').to_euler()
    lampm = mat('Sodium', 'ffcf8a', .3, 0, 25, 'ffb35c')
    for k, px in enumerate((-33, -11, 12)):          # quay lamp posts along the edge
        cyl((px, -2.2, 4.5), .12, 9, steel, 12); box((px, -1.6, 8.9), (.3, 1.4, .2), steel); box((px, -1.0, 8.75), (.5, .5, .12), lampm)
        pl = bpy.data.lights.new('Lamp', 'POINT'); pl.energy = 1500; pl.color = srgb('ffb35c'); pl.shadow_soft_size = .4
        po = bpy.data.objects.new('Lamp', pl); col.objects.link(po); po.location = (px, -1.0, 8.4)
    for px in (-40, -31, -13, -4, 5): bollard(px + .5, -.7)
    for p in ((-21.2, -7.4, 3.4, 1.4, .1), (-24.6, -9.6, 2.2, 1.1, -.3), (-18.8, -10.4, 2.6, 1.2, .5), (-22.5, -2.4, 3.8, .9, 0)): puddle(*p)
    foc = bpy.data.objects.new('Foc', None); col.objects.link(foc); foc.location = (tx + .4, ty - 1.2, 1.0)
    if WHICH == 'anim:hero':
        n = round(4.2 * FPS)
        key_cam((-17.2, -11.8, .5), (-24.4, -12.4, .7), (-21.7, -3.9, 1.45), (-22.4, -3.6, 1.5), (30, 32), (foc, 3.2), n)
        anim_common(n); render_anim('hero')
    elif WHICH == 'anim:close':
        n = round(2.6 * FPS)
        key_cam((-19.0, -9.8, .42), (-20.2, -8.3, .5), (-21.9, -4.6, 1.05), (-22.1, -4.4, 1.12), (30, 34), (foc, 2.4), n)
        anim_common(n); render_anim('close')
    elif WHICH in ('hero', 'all'):
        aim((-19.6, -12.0, .62), (-22.2, -3.8, 1.5), 32, dof=(8.4, 3.2)); render('hero')
