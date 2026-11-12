"""Suzuki Carry style 7-seater van ("سوزوكي ٧ راكب" / المشروع), exported for the player.

Run:  python3 tools/build_van.py public/models/van.glb [render_dir]
Nodes used by the game: Van > Body, SteerFL > WheelFL, SteerFR > WheelFR, WheelRL, WheelRR,
Seat1..Seat6 (empties where passengers sit), Plate, Slogan. Material "Paint" is the body colour.
Blender +Y = forward, +Z = up.
"""
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, 'build_cars.py')).read()
_argv = sys.argv; sys.argv = [_argv[0], '/dev/null']
exec(_src[:_src.index('# ------------------------------------------------------------ modern sedan')])
sys.argv = _argv
OUT = sys.argv[1] if len(sys.argv) > 1 else 'van.glb'
RENDER = sys.argv[2] if len(sys.argv) > 2 else None

M['paint'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*srgb('ffcf0a'), 1)
M['seat'] = mat('SeatFabric', '6b4a8a', 0.9)
_g = M['glass'].node_tree.nodes['Principled BSDF']; _g.inputs['Alpha'].default_value = 0.42; M['glass'].surface_render_method = 'BLENDED'
M['floor'] = mat('Floor', '2a2b2e', 0.95)
M['skin'] = mat('Skin', '8f6446', 0.6)
M['shirt'] = mat('Shirt', '3f6587', 0.8)
M['hair'] = mat('Hair', '1d1712', 0.7)
M['curtain'] = mat('Curtain', 'e9d9b5', 0.9)

# Suzuki Carry / Every style cab-over: front wheels under the front doors, short sloping nose, tall glasshouse.
L, W = 3.30, 1.40
hw, f = W / 2, L / 2
WF, WR, WZ, AR, TR = 1.00, -0.98, 0.27, 0.32, 0.27

root = bpy.data.objects.new('Van', None); col.objects.link(root)

prof = [(f - 0.05, 0.30), (f, 0.42), (f + 0.01, 0.62), (f - 0.03, 0.92), (f - 0.10, 1.00), (f - 0.55, 1.80), (f - 0.70, 1.89),
        (-f + 0.07, 1.90), (-f, 1.80), (-f, 0.34)] + arch(WR, WZ, AR) + arch(WF, WZ, AR)
body = bevel(extrude('Shell', prof, hw, [M['paint'], M['glass']], face_mat=lambda i: 1 if i == 4 else 0,
                     top_scale=(1.05, 1.90, 0.93)), 0.055, 3)
xs = lambda z: hw * (1 - 0.07 * min(1, max(0, (z - 1.05) / 0.85))) + 0.006
xf = lambda z: xs(z) - 0.002   # frames sit just under the glass
parts = [body]

def window(pts, s):
    cy = sum(p[0] for p in pts) / len(pts); cz = sum(p[1] for p in pts) / len(pts)
    grow = [(cy + (y - cy) * 1.0 + (0.03 if y > cy else -0.03), cz + (z - cz) + (0.03 if z > cz else -0.03)) for y, z in pts]
    parts.append(panel(grow, xf, M['black'], s))
    parts.append(panel(pts, xs, M['glass'], s))

for s in (1, -1):
    window([(f - 0.20, 1.10), (f - 0.56, 1.72), (0.66, 1.72), (0.66, 1.10)], s)            # front door
    window([(0.50, 1.12), (0.50, 1.73), (-0.38, 1.74), (-0.38, 1.12)], s)                   # sliding door
    window([(-0.50, 1.12), (-0.50, 1.74), (-1.50, 1.75), (-1.55, 1.62), (-1.55, 1.12)], s)  # rear quarter
    sx = lambda z: hw + 0.007
    for y0, y1 in ((0.66, 0.50), (-0.38, -0.50)):                                             # black B / C pillars
        parts.append(panel([(y0, 1.08), (y0, 1.76), (y1, 1.76), (y1, 1.08)], lambda z: xs(z) - 0.001, M['black'], s))
    parts.append(panel([(f - 0.04, 0.955), (-f + 0.04, 0.955), (-f + 0.04, 0.99), (f - 0.04, 0.99)], sx, M['black'], s))     # body stripe
    parts.append(panel([(0.2, 0.915), (-f + 0.2, 0.915), (-f + 0.2, 0.93), (0.2, 0.93)], sx, M['black'], s))                 # pinstripe
    for y in (0.66, 0.52, -0.40):                                                                                             # door seams
        parts.append(panel([(y + 0.006, 0.36), (y + 0.006, 1.06), (y - 0.006, 1.06), (y - 0.006, 0.36)], sx, M['black'], s))
    parts.append(panel([(-0.42, 1.03), (-1.45, 1.03), (-1.45, 1.05), (-0.42, 1.05)], sx, M['steel'], s))                     # sliding rail
    parts.append(box(s * (hw - 0.01), s * (hw + 0.014), 0.86, 1.0, 1.0, 1.04, M['black'], 0.006))                             # handles
    parts.append(box(s * (hw - 0.01), s * (hw + 0.014), 0.30, 0.44, 1.0, 1.04, M['black'], 0.006))
    parts.append(cyl(0.05, 0.012, (s * (hw + 0.004), -1.2, 0.82), M['black'], axis='X', seg=14))                              # fuel cap
    parts.append(box(s * (hw - 0.05), s * (hw + 0.08), -0.62, 0.66, 0.31, 0.35, M['chrome'], 0.01))                           # running board
    parts.append(box(s * (hw - 0.02), s * (hw + 0.13), 1.36, 1.39, 1.20, 1.22, M['black']))                                   # mirror arm
    parts.append(box(s * (hw + 0.10), s * (hw + 0.17), 1.30, 1.40, 1.10, 1.34, M['black'], 0.02))                            # mirror
    parts.append(box(s * (hw * 0.93 - 0.02), s * (hw * 0.93 + 0.02), -f + 0.1, f - 0.75, 1.88, 1.91, M['black']))             # rain gutter
    parts.append(box(s * 0.34, s * 0.62, f - 0.01, f + 0.035, 0.66, 0.82, M['head'], 0.012))                                   # headlamps
    parts.append(box(s * 0.32, s * 0.64, f - 0.02, f + 0.022, 0.64, 0.84, M['chrome'], 0.01))
    parts.append(box(s * 0.50, s * 0.64, f + 0.02, f + 0.07, 0.48, 0.56, M['amber'], 0.01))                                  # turn signals
    parts.append(box(s * (hw - 0.15), s * (hw - 0.02), -f - 0.035, -f + 0.02, 0.62, 0.98, M['tail'], 0.012))                 # tail lamps
    parts.append(box(s * (hw - 0.15), s * (hw - 0.02), -f - 0.035, -f + 0.02, 0.52, 0.61, M['amber'], 0.01))
    for y in (0.42, -0.58, -1.2):                                                                                              # curtains
        parts.append(box(s * (hw - 0.10), s * (hw - 0.06), y - 0.16, y, 1.16, 1.68, M['curtain'], 0.02))
parts.append(box(-0.30, 0.30, f - 0.005, f + 0.03, 0.66, 0.82, M['black'], 0.01))                                              # grille
for z in (0.69, 0.735, 0.78):
    parts.append(box(-0.28, 0.28, f + 0.03, f + 0.04, z, z + 0.018, M['chrome']))
parts.append(box(-0.09, 0.09, f + 0.035, f + 0.05, 0.725, 0.775, M['chrome'], 0.008))                                         # badge
parts.append(box(-hw - 0.02, hw + 0.02, f - 0.06, f + 0.11, 0.30, 0.47, M['black'], 0.04))                                    # bumpers
parts.append(box(-hw + 0.08, hw - 0.08, f + 0.10, f + 0.125, 0.40, 0.43, M['chrome'], 0.005))
parts.append(box(-hw - 0.02, hw + 0.02, -f - 0.11, -f + 0.05, 0.30, 0.45, M['black'], 0.04))
parts.append(box(-0.62, 0.62, -f - 0.014, -f + 0.01, 1.12, 1.74, M['black'], 0.02))                                           # rear window frame
parts.append(box(-0.58, 0.58, -f - 0.02, -f + 0.0, 1.15, 1.71, M['glass']))
parts.append(box(-0.16, 0.16, -f - 0.02, -f + 0.0, 1.78, 1.83, M['tail']))                                                     # high brake light
parts.append(box(-0.12, 0.12, -f - 0.03, -f - 0.01, 0.96, 1.02, M['chrome']))                                                  # hatch handle
for x in (-0.28, 0.24):                                                                                                         # wipers
    parts.append(box(x - 0.01, x + 0.01, f - 0.16, f - 0.12, 1.02, 1.04, M['black']))
    parts.append(box(x - 0.012, x + 0.30, f - 0.15, f - 0.13, 1.03, 1.05, M['black']))
parts.append(box(-0.66, 0.66, f - 0.72, f - 0.52, 1.86, 1.93, M['black'], 0.02))                                              # sun visor
parts.append(box(-0.56, 0.56, -1.45, 0.75, 1.92, 1.95, M['steel']))                                                            # roof rack
for y in (-1.4, -0.7, 0.0, 0.7):
    parts.append(box(-0.60, 0.60, y, y + 0.04, 1.95, 1.99, M['chrome']))
for x in (-0.6, 0.56):
    parts.append(box(x, x + 0.04, -1.45, 0.75, 1.95, 1.99, M['chrome']))
# interior: floor, driver seat, two benches of three
parts.append(box(-hw + 0.06, hw - 0.06, -f + 0.1, f - 0.25, 0.36, 0.40, M['floor']))
parts.append(box(-0.12, 0.60, 0.62, 1.00, 0.40, 0.70, M['seat'], 0.03))
parts.append(box(-0.12, 0.60, 0.55, 0.66, 0.70, 1.30, M['seat'], 0.03))
for y in (0.0, -0.95):
    parts.append(box(-hw + 0.08, hw - 0.08, y - 0.18, y + 0.24, 0.40, 0.62, M['seat'], 0.03))
    parts.append(box(-hw + 0.08, hw - 0.08, y - 0.28, y - 0.16, 0.62, 1.22, M['seat'], 0.03))
parts.append(box(-hw + 0.08, hw - 0.08, f - 0.5, f - 0.2, 0.92, 1.0, M['black'], 0.02))                                       # dashboard
parts.append(cyl(0.17, 0.5, (0.25, 0.78, 0.98), M['shirt'], axis='Z', seg=14))                                               # driver
parts.append(cyl(0.11, 0.24, (0.25, 0.78, 1.36), M['skin'], axis='Z', seg=14))
parts.append(cyl(0.115, 0.06, (0.25, 0.78, 1.49), M['hair'], axis='Z', seg=14))
parts.append(cyl(0.18, 0.035, (0.25, 1.12, 1.10), M['black'], axis='Y', seg=20))                                              # steering wheel
parts.append(box(-0.11, 0.11, f + 0.11, f + 0.13, 0.33, 0.43, M['plate']))
parts.append(box(-0.2, 0.2, -f - 0.04, -f - 0.02, 0.50, 0.62, M['plate']))
b = finish('Body', parts); b.parent = root

def wheel_obj(name, loc, side, steer_parent=None):
    ps = wheel(0, side * 1e-4, TR, 0.18, z=0, rim_r=0.19)   # built at the origin, rim facing outwards
    w = finish(name, ps); w.location = loc
    w.parent = steer_parent or root
    return w

for s, nm in ((-1, 'L'), (1, 'R')):
    st = bpy.data.objects.new('SteerF' + nm, None); col.objects.link(st); st.parent = root; st.location = (s * (hw - 0.14), WF, WZ)
    wheel_obj('WheelF' + nm, (0, 0, 0), s, st)
    wheel_obj('WheelR' + nm, (s * (hw - 0.14), WR, WZ), s)
seats = [(-0.42, 0.06), (0.0, 0.06), (0.42, 0.06), (-0.42, -0.89), (0.0, -0.89), (0.42, -0.89)]
for i, (x, y) in enumerate(seats):
    e = bpy.data.objects.new('Seat%d' % (i + 1), None); col.objects.link(e); e.parent = root; e.location = (x, y, 0.62)
plate = bpy.data.objects.new('PlateR', None); col.objects.link(plate); plate.parent = root; plate.location = (0, -f - 0.05, 0.56)
slog = bpy.data.objects.new('SloganPt', None); col.objects.link(slog); slog.parent = root; slog.location = (0, -f - 0.02, 1.07)

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_yup=True, use_selection=False)
print('exported', OUT, os.path.getsize(OUT))

if RENDER:
    os.makedirs(RENDER, exist_ok=True)
    world = bpy.data.worlds.new('W'); scn.world = world; world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.8, 0.84, 0.9, 1)
    sun = bpy.data.lights.new('Sun', 'SUN'); sun.energy = 3.5
    so = bpy.data.objects.new('Sun', sun); so.rotation_euler = (math.radians(50), 0, math.radians(30)); col.objects.link(so)
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=12); obj('Floor', bm, [mat('FloorM', '999999', 0.8)])
    cam = bpy.data.cameras.new('Cam'); cam.lens = 40
    co = bpy.data.objects.new('Cam', cam); col.objects.link(co); scn.camera = co
    scn.render.engine = 'CYCLES'; scn.cycles.samples = 32; scn.render.resolution_x = 900; scn.render.resolution_y = 650
    for nm, p in {'front3q': (4.6, 5.4, 2.4), 'rear3q': (-4.2, -5.2, 2.6), 'side': (6.5, 0.0, 1.4)}.items():
        co.location = p; d = Vector((0, 0, 1.0)) - Vector(p)
        co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        scn.render.filepath = os.path.join(RENDER, nm + '.png'); bpy.ops.render.render(write_still=True)
