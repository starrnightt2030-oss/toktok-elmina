"""People for the streets, the riders and the driver: rigged, animated, Egyptian everyday clothing. One GLB.

Run:  python3 tools/build_people.py public/models/people.glb [render_dir]

Every figure shares the same skeleton (bone names without dots so three.js keeps them as they are) and the same clips:
  Idle  standing, breathing, small weight shift          Walk  1 s walking cycle
  Wave  standing, raising the right hand to stop a tuk    Sit   seated on a bench (tuk / van seat)
  Pay   seated, reaching forward with money               Drive seated, hands forward on a handlebar / wheel
Variants (top-level objects, each an armature with one skinned mesh): Man, Galabeya, Abaya, Hijab, Youth, Worker, Elder.
Colours are not baked: each vertex carries a region id in its colour (R = id / 16) and the game paints the regions per person
(skin, hair, top, bottom, shoes, headwear, robe …) from a small palette, so one model gives many different people.
The figures face -Y in Blender, which is +Z in the game (the direction the game's people walk).
"""
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix

OUT = sys.argv[1] if len(sys.argv) > 1 else 'people.glb'
RENDER = sys.argv[2] if len(sys.argv) > 2 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene; col = scn.collection
scn.render.fps = 30

# region ids (the game's palette slots)
SKIN, HAIR, TOP, BOTTOM, SHOES, HEADW, ROBE, DARK, WHITE, LIPS, ACCENT = range(11)

# ---------------------------------------------------------------- skeleton (metres, Z up, facing -Y)
BONES = [  # name, head, tail, parent
    ('Hips', (0, 0, .96), (0, 0, 1.08), None),
    ('Spine', (0, 0, 1.08), (0, 0, 1.26), 'Hips'),
    ('Chest', (0, 0, 1.26), (0, 0, 1.46), 'Spine'),
    ('Neck', (0, 0, 1.46), (0, -.01, 1.56), 'Chest'),
    ('Head', (0, -.01, 1.56), (0, -.01, 1.76), 'Neck'),
]
for s, n in ((1, 'L'), (-1, 'R')):
    BONES += [
        ('Thigh' + n, (s * .095, 0, .94), (s * .1, -.01, .52), 'Hips'),
        ('Shin' + n, (s * .1, -.01, .52), (s * .1, .015, .09), 'Thigh' + n),
        ('Foot' + n, (s * .1, .015, .09), (s * .1, -.13, .03), 'Shin' + n),
        ('Shoulder' + n, (s * .04, 0, 1.43), (s * .18, .0, 1.44), 'Chest'),
        ('UpperArm' + n, (s * .19, 0, 1.43), (s * .245, .01, 1.16), 'Shoulder' + n),
        ('Forearm' + n, (s * .245, .01, 1.16), (s * .28, -.03, .92), 'UpperArm' + n),
        ('Hand' + n, (s * .28, -.03, .92), (s * .29, -.04, .81), 'Forearm' + n),
    ]
BMAP = {b[0]: b for b in BONES}

def seg_dist(p, a, b):
    a, b = Vector(a), Vector(b); ab = b - a; t = max(0, min(1, (p - a).dot(ab) / ab.length_squared))
    return (a + ab * t - p).length

def make_armature(name):
    arm = bpy.data.armatures.new(name + 'Rig'); ob = bpy.data.objects.new(name, arm); col.objects.link(ob)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for n, h, t, p in BONES:
        e = arm.edit_bones.new(n); e.head = h; e.tail = t
        if p: e.parent = arm.edit_bones[p]; e.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT'); ob.select_set(False)
    return ob

# ---------------------------------------------------------------- mesh building: parts carry a region and a bone set to weight against
class Part:
    def __init__(self, bm, region, bones):
        self.bm, self.region, self.bones = bm, region, bones

PARTS = []
def add(bm, region, bones): PARTS.append(Part(bm, region, bones)); return bm

def tube(path, radii, region, bones, seg=10, cap=(True, True), ry=None):
    """A smooth tube through points `path` with radius `radii` (scalar or (rx, ry) ellipse) per point."""
    bm = bmesh.new(); rings = []
    for i, p in enumerate(path):
        p = Vector(p); d = (Vector(path[min(i + 1, len(path) - 1)]) - Vector(path[max(i - 1, 0)])).normalized()
        up = Vector((0, 1, 0)) if abs(d.y) < .9 else Vector((1, 0, 0)); u = d.cross(up).normalized(); v = d.cross(u).normalized()
        r = radii[i]; rx, rz = (r, r) if not isinstance(r, tuple) else r
        rings.append([bm.verts.new(p + u * math.cos(2 * math.pi * k / seg) * rx + v * math.sin(2 * math.pi * k / seg) * rz) for k in range(seg)])
    for a, b in zip(rings, rings[1:]):
        for k in range(seg): bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
    if cap[0]: c = bm.verts.new(Vector(path[0]) - (Vector(path[1]) - Vector(path[0])).normalized() * 0.01); [bm.faces.new((rings[0][(k + 1) % seg], rings[0][k], c)) for k in range(seg)]
    if cap[1]: c = bm.verts.new(Vector(path[-1]) + (Vector(path[-1]) - Vector(path[-2])).normalized() * 0.01); [bm.faces.new((rings[-1][k], rings[-1][(k + 1) % seg], c)) for k in range(seg)]
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return add(bm, region, bones)

def ellipsoid(c, r, region, bones, seg=14, rings=10, cut=None):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1)
    for v in bm.verts: v.co = Vector((c[0] + v.co.x * r[0], c[1] + v.co.y * r[1], c[2] + v.co.z * r[2]))
    if cut: bmesh.ops.delete(bm, geom=[v for v in bm.verts if cut(v.co)], context='VERTS')
    return add(bm, region, bones)

def lathe(prof, region, bones, seg=16, cx=0, cy=0, sy=1.0):
    """Surface of revolution round the Z axis: prof = [(radius, z)], sy squashes front-back."""
    bm = bmesh.new(); rings = [[bm.verts.new((cx + r * math.cos(2 * math.pi * k / seg), cy + r * sy * math.sin(2 * math.pi * k / seg), z)) for k in range(seg)] for r, z in prof]
    for a, b in zip(rings, rings[1:]):
        for k in range(seg): bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return add(bm, region, bones)

def boxp(c, s, region, bones):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts: v.co = Vector((c[0] + v.co.x * s[0], c[1] + v.co.y * s[1], c[2] + v.co.z * s[2]))
    return add(bm, region, bones)

LEGS = lambda n: ['Hips', 'Thigh' + n, 'Shin' + n]
ARM = lambda n: ['Chest', 'Shoulder' + n, 'UpperArm' + n, 'Forearm' + n, 'Hand' + n]

def body(o):
    """The person underneath the clothes: o = dict(sleeve='long'|'short', top, bottom, robe, build)."""
    w = o.get('build', 1.0)
    # torso: lathe from hips to neck, slightly flattened front-back
    top, bot = (ROBE if o.get('robe') else o.get('top', TOP)), o.get('bottom', BOTTOM)
    prof = [(.155 * w, .9), (.17 * w, .97), (.166 * w, 1.04), (.152 * w, 1.12), (.158 * w, 1.2), (.175 * w, 1.28), (.188 * w, 1.35), (.185 * w, 1.40), (.15, 1.445), (.09, 1.47), (.05, 1.475)]
    tor = lathe(prof, top, ['Hips', 'Spine', 'Chest', 'Neck'], seg=20, sy=.6)
    lathe([(.155 * w, .82), (.16 * w, .9), (.17 * w, .97)], bot, ['Hips', 'ThighL', 'ThighR'], seg=18, sy=.66)   # waistband / seat
    tube([(0, -.005, 1.45), (0, -.01, 1.52), (0, -.012, 1.58)], [.052, .05, .05], SKIN, ['Chest', 'Neck', 'Head'], cap=(False, False))
    for s, n in ((1, 'L'), (-1, 'R')):
        hb, kn, an = BMAP['Thigh' + n][1], BMAP['Shin' + n][1], BMAP['Shin' + n][2]
        tube([hb, ((hb[0] + kn[0]) / 2, -.005, .74), kn, ((kn[0] + an[0]) / 2, .005, .3), an], [(.088 * w, .085 * w), (.075 * w, .072 * w), (.056, .056), (.05, .052), .04], bot, LEGS(n), seg=14)
        ellipsoid(kn, (.058, .058, .06), bot, ['Thigh' + n, 'Shin' + n], seg=12, rings=8)                                                 # knee
        # shoe
        ellipsoid((s * .1, -.045, .045), (.052, .13, .05), SHOES, ['Foot' + n, 'Shin' + n], seg=12, rings=8)
        boxp((s * .1, -.045, .012), (.105, .27, .025), DARK, ['Foot' + n])
        sh, el, wr, ht = BMAP['UpperArm' + n][1], BMAP['Forearm' + n][1], BMAP['Hand' + n][1], BMAP['Hand' + n][2]
        sl = ROBE if o.get('robe') else TOP
        long_ = o.get('sleeve', 'long') == 'long'
        ellipsoid((s * .178, 0, 1.40), (.058 * w, .058, .064), sl, ['Chest', 'Shoulder' + n, 'UpperArm' + n], seg=14, rings=10)        # deltoid
        tube([(s * .195, 0, 1.40), ((sh[0] + el[0]) / 2 + s * .005, 0, 1.29), el], [.058 * w, .052 * w, .045], sl, ARM(n), seg=12, cap=(False, False))
        ellipsoid(el, (.046, .046, .046), sl, ['UpperArm' + n, 'Forearm' + n], seg=10, rings=8)                                          # elbow
        tube([el, ((el[0] + wr[0]) / 2, -.01, 1.04), wr], [.045, .041, .033], sl if long_ else SKIN, ['UpperArm' + n, 'Forearm' + n, 'Hand' + n], seg=12, cap=(False, False))
        if long_: tube([(wr[0] - s * .004, wr[1] + .002, wr[2] + .03), (wr[0], wr[1], wr[2] - .005)], [.036, .036], sl, ['Forearm' + n, 'Hand' + n], seg=10, cap=(False, True))
        # hand: palm + thumb
        ellipsoid(((wr[0] + ht[0]) / 2, (wr[1] + ht[1]) / 2, (wr[2] + ht[2]) / 2 + .01), (.023, .036, .054), SKIN, ['Hand' + n], seg=10, rings=7)
        ellipsoid((wr[0] - s * .004, wr[1] - .035, wr[2] - .03), (.014, .016, .032), SKIN, ['Hand' + n], seg=8, rings=5)
    # shirt collar / buttons
    if o.get('collar', True) and not o.get('robe'):
        tube([(0, -.02, 1.45), (0, -.02, 1.49)], [(.075, .058), (.07, .055)], top, ['Chest', 'Neck'], seg=14, cap=(False, False))
    if o.get('belt'): lathe([(.172 * w, .905), (.174 * w, .94)], DARK, ['Hips'], seg=18, sy=.66)
    return tor

def head(o):
    hz = 1.645
    ellipsoid((0, -.012, hz), (.088, .1, .118), SKIN, ['Head', 'Neck'], seg=18, rings=14)          # skull + face
    ellipsoid((0, -.07, hz - .055), (.06, .05, .05), SKIN, ['Head'], seg=12, rings=8)              # jaw / chin
    ellipsoid((0, -.104, hz - .008), (.011, .016, .024), SKIN, ['Head'], seg=8, rings=6)             # nose
    for s in (1, -1):
        ellipsoid((s * .089, -.01, hz - .005), (.012, .022, .03), SKIN, ['Head'], seg=8, rings=6)   # ears
        ellipsoid((s * .033, -.091, hz + .016), (.016, .008, .011), WHITE, ['Head'], seg=10, rings=6)
        ellipsoid((s * .033, -.0975, hz + .016), (.0085, .0045, .0095), DARK, ['Head'], seg=8, rings=5)
        boxp((s * .036, -.094, hz + .042), (.034, .008, .008), HAIR, ['Head'])                       # eyebrows
    boxp((0, -.098, hz - .05), (.036, .006, .008), LIPS, ['Head'])
    if o.get('mustache'): boxp((0, -.104, hz - .033), (.05, .01, .012), HAIR, ['Head'])
    if o.get('beard'): ellipsoid((0, -.078, hz - .07), (.066, .045, .05), HAIR, ['Head'], seg=12, rings=8, cut=lambda c: c.z > hz - .045)
    hair = o.get('hair', 'short')
    if hair == 'short': ellipsoid((0, .0, hz + .03), (.094, .106, .1), HAIR, ['Head'], seg=18, rings=12, cut=lambda c: c.z < hz + .005 and c.y < -.02 or c.z < hz - .04 or (c.y < -.07 and c.z < hz + .07))
    elif hair == 'thin': ellipsoid((0, .02, hz + .0), (.092, .1, .09), HAIR, ['Head'], seg=18, rings=12, cut=lambda c: c.z > hz + .055 or c.y < -.03 or c.z < hz - .05)
    hw = o.get('headwear')
    if hw == 'hijab':
        ellipsoid((0, -.004, hz + .01), (.108, .118, .136), HEADW, ['Head', 'Neck'], seg=20, rings=14,
                  cut=lambda c: c.y < -.06 and hz - .085 < c.z < hz + .07 and abs(c.x) < .085)
        lathe([(.075, 1.6), (.112, 1.53), (.165, 1.475), (.19, 1.43), (.198, 1.37), (.185, 1.3), (.165, 1.255)], HEADW, ['Neck', 'Chest', 'Head'], seg=22, sy=.74)
    elif hw == 'cap':
        ellipsoid((0, .005, hz + .065), (.098, .108, .07), HEADW, ['Head'], seg=18, rings=10, cut=lambda c: c.z < hz + .062)
        tube([(0, .005, hz + .055), (0, .005, hz + .066)], [(.098, .108), (.098, .108)], HEADW, ['Head'], seg=18, cap=(False, False))
        ellipsoid((0, -.13, hz + .06), (.075, .065, .01), HEADW, ['Head'], seg=14, rings=6)
    elif hw == 'helmet':
        ellipsoid((0, 0, hz + .072), (.118, .128, .1), HEADW, ['Head'], seg=18, rings=10, cut=lambda c: c.z < hz + .068)
        lathe([(.125, hz + .068), (.15, hz + .062), (.15, hz + .054), (.125, hz + .054)], HEADW, ['Head'], seg=18, sy=1.1, cy=-.01)
    elif hw == 'taqiya':
        tube([(0, .005, hz + .05), (0, .005, hz + .1)], [(.096, .106), (.09, .1)], HEADW, ['Head'], seg=16, cap=(False, True))

def robe(o, z0=.1, collar=1.46, flare=.3):
    """Galabeya / abaya: from the shoulders to the ankles, flaring out, weighted to hips and legs so it swings with them."""
    lathe([(.12, collar), (.2, 1.42), (.205, 1.34), (.19, 1.2), (.19, 1.05), (.205, .9), (.235, .6), (flare - .02, .3), (flare, z0 + .02), (flare - .01, z0)], ROBE,
          ['Chest', 'Spine', 'Hips', 'ThighL', 'ThighR', 'ShinL', 'ShinR'], seg=22, sy=.7)

def bag(o):
    boxp((.2, .02, 1.0), (.05, .2, .22), ACCENT, ['Hips', 'Spine'])
    tube([(.16, .0, 1.1), (.08, -.06, 1.36), (-.12, -.05, 1.44)], [.012, .012, .012], ACCENT, ['Chest', 'Spine'], seg=6)

# ---------------------------------------------------------------- skinning: each vertex weights to the 2 nearest bones of its part
def bake(name, arm):
    bm = bmesh.new(); reg = []
    for P in PARTS:
        me = bpy.data.meshes.new('tmp'); P.bm.to_mesh(me); P.bm.free()
        off = len(bm.verts); bm.from_mesh(me); bpy.data.meshes.remove(me)
        for v in bm.verts[off:] if hasattr(bm.verts, '__getitem__') else []: pass
        bm.verts.ensure_lookup_table()
        reg += [(P.region, P.bones)] * (len(bm.verts) - off)
    bm.verts.ensure_lookup_table()
    me = bpy.data.meshes.new(name + 'Mesh'); bm.to_mesh(me)
    # vertex colours: region id in R, written per corner
    if not me.color_attributes.get('Col'): me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    ca = me.color_attributes['Col']
    for poly in me.polygons:
        for li in poly.loop_indices:
            r = reg[me.loops[li].vertex_index][0]; ca.data[li].color = ((r + .5) / 16, 0, 0, 1)
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name + 'Body', me); col.objects.link(ob); ob.parent = arm
    mt = bpy.data.materials.get('Person') or bpy.data.materials.new('Person'); me.materials.append(mt)
    groups = {n: ob.vertex_groups.new(name=n) for n, *_ in BONES}
    for i, v in enumerate(me.vertices):
        bones = reg[i][1]; d = sorted((seg_dist(v.co, BMAP[b][1], BMAP[b][2]), b) for b in bones)
        if len(d) == 1 or d[1][0] > d[0][0] * 2.2: groups[d[0][1]].add([i], 1.0, 'REPLACE'); continue
        w0, w1 = 1 / (d[0][0] + 1e-4) ** 3, 1 / (d[1][0] + 1e-4) ** 3; s = w0 + w1
        groups[d[0][1]].add([i], w0 / s, 'REPLACE'); groups[d[1][1]].add([i], w1 / s, 'REPLACE')
    md = ob.modifiers.new('rig', 'ARMATURE'); md.object = arm
    PARTS.clear(); bm.free()
    return ob

VARIANTS = {
    'Man':      dict(sleeve='long', hair='short', mustache=True, belt=True),
    'Youth':    dict(sleeve='short', hair='short', headwear='cap', build=.95),
    'Worker':   dict(sleeve='long', hair='short', headwear='helmet', mustache=True, build=1.05, belt=True),
    'Galabeya': dict(sleeve='long', hair='short', robe=True, mustache=True),
    'Elder':    dict(sleeve='long', hair='thin', robe=True, headwear='taqiya', beard=True, build=1.05),
    'Hijab':    dict(sleeve='long', hair=None, headwear='hijab', build=.92, skirt=True),
    'Abaya':    dict(sleeve='long', hair=None, headwear='hijab', robe=True, build=.95),
}
ARMS = {}
for i, (name, o) in enumerate(VARIANTS.items()):
    arm = make_armature(name); ARMS[name] = arm
    o = dict(o)
    if o.get('robe'): o['robe'] = True
    body(o); head(o)
    if o.get('robe'): robe(o, flare=.27 if name != 'Abaya' else .3)
    if o.get('skirt'): lathe([(.165, .98), (.18, .8), (.22, .5), (.25, .2), (.255, .1)], BOTTOM, ['Hips', 'ThighL', 'ThighR', 'ShinL', 'ShinR'], seg=22, sy=.72)
    if name in ('Youth', 'Hijab'): bag(o)
    ob = bake(name, arm); print('variant', name, 'tris', sum(len(p.vertices) - 2 for p in ob.data.polygons))

# ---------------------------------------------------------------- animation clips (pose-bone rotations, XYZ euler, radians)
def clip(name, frames, keys, loop=True):
    """keys: {frame: {bone: (x, y, z)}} — missing bones stay at rest."""
    act = bpy.data.actions.new(name)
    allb = [b[0] for b in BONES]
    for arm in ARMS.values():
        if not arm.animation_data: arm.animation_data_create()
    arm0 = list(ARMS.values())[0]
    arm0.animation_data.action = act
    for pb in arm0.pose.bones: pb.rotation_mode = 'XYZ'
    for f, pose in sorted(keys.items()):
        for b in allb:
            pb = arm0.pose.bones[b]; pb.rotation_euler = pose.get(b, (0, 0, 0)); L = pose.get('_loc', (0, 0, 0)); pb.location = (L[0], L[2], -L[1]) if b == 'Hips' else (0, 0, 0)
            pb.keyframe_insert('rotation_euler', frame=f)
            if b == 'Hips': pb.keyframe_insert('location', frame=f)
    act.use_fake_user = True
    return act

R = math.radians
def walk_pose(t):
    """t in 0..1 of the cycle; left leg forward at t=0."""
    a = math.sin(2 * math.pi * t); a2 = math.sin(2 * math.pi * t + math.pi)
    def leg(ph):  # ph: swing phase sin
        k = max(0, math.sin(2 * math.pi * t + (0 if ph > 0 else math.pi) - .9))
        return k
    kL = max(0, -math.sin(2 * math.pi * t - .6)) * R(55) + R(4)
    kR = max(0, -math.sin(2 * math.pi * t + math.pi - .6)) * R(55) + R(4)
    return {
        '_loc': (0, 0, -abs(math.cos(2 * math.pi * t)) * .025 + .012),
        'Hips': (0, 0, a * R(5)), 'Spine': (R(4), 0, -a * R(3)), 'Chest': (0, 0, -a * R(6)), 'Head': (R(-3), 0, a * R(4)),
        'ThighL': (-a * R(27) - R(3), 0, 0), 'ThighR': (-a2 * R(27) - R(3), 0, 0),
        'ShinL': (kL, 0, 0), 'ShinR': (kR, 0, 0),
        'FootL': (a * R(10) - R(6), 0, 0), 'FootR': (a2 * R(10) - R(6), 0, 0),
        'UpperArmL': (a2 * R(24), 0, R(4)), 'UpperArmR': (a * R(24), 0, -R(4)),
        'ForearmL': (R(18) + max(0, -a2) * R(22), 0, 0), 'ForearmR': (R(18) + max(0, -a) * R(22), 0, 0),
    }
# NB: thigh rotation about X: negative = swing forward (toward -Y)
clip('Walk', 30, {f: walk_pose(f / 30) for f in range(0, 31, 3)})
clip('Idle', 120, {0: {'Chest': (R(1), 0, 0), 'UpperArmL': (0, 0, R(3)), 'UpperArmR': (0, 0, -R(3)), 'ForearmL': (R(8), 0, 0), 'ForearmR': (R(8), 0, 0)},
                   60: {'_loc': (0, 0, -.004), 'Hips': (0, 0, R(2)), 'Chest': (R(-1.5), 0, R(-1)), 'Head': (0, 0, R(5)), 'UpperArmL': (0, 0, R(4)), 'UpperArmR': (0, 0, -R(4)), 'ForearmL': (R(12), 0, 0), 'ForearmR': (R(12), 0, 0)},
                   120: {'Chest': (R(1), 0, 0), 'UpperArmL': (0, 0, R(3)), 'UpperArmR': (0, 0, -R(3)), 'ForearmL': (R(8), 0, 0), 'ForearmR': (R(8), 0, 0)}})
wave = lambda k: {'Chest': (0, 0, R(4)), 'Head': (R(-4), 0, R(-6)), 'UpperArmR': (R(15), 0, R(140)), 'ForearmR': (R(20), 0, R(k)), 'HandR': (0, 0, R(k * .6)), 'UpperArmL': (0, 0, R(3)), 'ForearmL': (R(8), 0, 0)}
clip('Wave', 40, {0: wave(-20), 10: wave(20), 20: wave(-20), 30: wave(20), 40: wave(-20)})
sit = {'_loc': (0, .02, -.47), 'Hips': (0, 0, 0), 'Spine': (R(-4), 0, 0), 'ThighL': (R(-88), 0, R(-4)), 'ThighR': (R(-88), 0, R(4)), 'ShinL': (R(88), 0, 0), 'ShinR': (R(88), 0, 0),
       'FootL': (R(-4), 0, 0), 'FootR': (R(-4), 0, 0), 'UpperArmL': (R(14), 0, R(4)), 'UpperArmR': (R(14), 0, R(-4)), 'ForearmL': (R(58), 0, 0), 'ForearmR': (R(58), 0, 0)}
clip('Sit', 60, {0: sit, 30: dict(sit, Head=(R(-2), 0, R(6)), Chest=(R(1), 0, 0)), 60: sit})
pay = dict(sit, UpperArmR=(R(62), 0, R(4)), ForearmR=(R(22), 0, 0), Head=(R(6), 0, 0))
clip('Pay', 40, {0: sit, 15: pay, 30: pay, 40: sit}, loop=False)
drive = dict(sit, Spine=(R(6), 0, 0), UpperArmL=(R(55), 0, R(-8)), UpperArmR=(R(55), 0, R(8)), ForearmL=(R(35), 0, 0), ForearmR=(R(35), 0, 0))
clip('Drive', 60, {0: drive, 30: dict(drive, Head=(0, 0, R(4))), 60: drive})
for arm in ARMS.values(): arm.animation_data.action = None
# every clip as an NLA track on the first figure: the exporter writes one glTF animation per track (bone names are shared)
arm0 = list(ARMS.values())[0]
for act in [a for a in bpy.data.actions]:
    tr = arm0.animation_data.nla_tracks.new(); tr.name = act.name
    st = tr.strips.new(act.name, int(act.frame_range[0]), act); st.name = act.name
    if hasattr(st, 'action_slot') and act.slots: st.action_slot = act.slots[0]

# lay variants out in a row (the game uses them at the origin; positions only matter for the preview)
for i, arm in enumerate(ARMS.values()): arm.location.x = 0

kw = dict(filepath=OUT, export_format='GLB', export_yup=True, export_animations=True, export_skins=True, use_selection=False)
props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
if 'export_animation_mode' in props: kw['export_animation_mode'] = 'NLA_TRACKS'
if 'export_vertex_color' in props: kw['export_vertex_color'] = 'ACTIVE'
if 'export_all_vertex_colors' in props: kw['export_all_vertex_colors'] = True
if 'export_force_sampling' in props: kw['export_force_sampling'] = True
bpy.ops.export_scene.gltf(**kw)
print('exported', OUT, os.path.getsize(OUT))

if RENDER:
    os.makedirs(RENDER, exist_ok=True)
    PAL = {SKIN: 'b07a55', HAIR: '1d1712', TOP: '3f6587', BOTTOM: '2a3550', SHOES: '2b2420', HEADW: '1f1f2a', ROBE: 'e9e2d0', DARK: '151515', WHITE: 'f2efe8', LIPS: '8a4a3a', ACCENT: '6b4a2b'}
    def srgb(h): c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]; return tuple(((x + .055) / 1.055) ** 2.4 if x > .04045 else x / 12.92 for x in c)
    for i, (name, arm) in enumerate(ARMS.items()):
        arm.location.x = (i - 3) * .8
        ob = [c for c in arm.children][0]; ca = ob.data.color_attributes['Col']
        for d in ca.data: rid = int(d.color[0] * 16); d.color = (*srgb(PAL.get(rid, 'ff00ff')), 1)
    mt = bpy.data.materials['Person']; mt.use_nodes = True; nt = mt.node_tree
    vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'; nt.links.new(vc.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])
    nt.nodes['Principled BSDF'].inputs['Roughness'].default_value = .75
    world = bpy.data.worlds.new('W'); scn.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.8, 0.84, 0.9, 1)
    sun = bpy.data.lights.new('Sun', 'SUN'); sun.energy = 3.5
    so = bpy.data.objects.new('Sun', sun); so.rotation_euler = (math.radians(50), 0, math.radians(-30)); col.objects.link(so)
    cam = bpy.data.cameras.new('Cam'); cam.lens = 50; co = bpy.data.objects.new('Cam', cam); col.objects.link(co); scn.camera = co
    scn.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'CYCLES'
    try: scn.cycles.samples = 24
    except Exception: pass
    scn.render.resolution_x = 1600; scn.render.resolution_y = 700
    for arm in ARMS.values():
        if not arm.animation_data: arm.animation_data_create()
    for nm, p, tgt, act, fr in [('front', (0, -7.5, 1.2), (0, 0, .9), None, 0), ('walk', (-3.5, -6, 1.3), (0, 0, .9), 'Walk', 8), ('face', (-2.4, -1.6, 1.65), (-2.4, 0, 1.62), None, 0), ('sit', (2.5, -6.5, 1.0), (0, 0, .6), 'Sit', 0)]:
        for arm in ARMS.values():
            arm.animation_data.action = bpy.data.actions[act] if act else None
            if act and hasattr(arm.animation_data, 'action_slot') and bpy.data.actions[act].slots: arm.animation_data.action_slot = bpy.data.actions[act].slots[0]
        scn.frame_set(fr)
        co.location = p; d = Vector(tgt) - Vector(p); co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        scn.render.filepath = os.path.join(RENDER, 'people_' + nm + '.png'); bpy.ops.render.render(write_still=True)
