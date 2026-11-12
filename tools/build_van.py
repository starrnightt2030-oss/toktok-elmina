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

M['paint'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*srgb('ffc107'), 1)
M['seat'] = mat('SeatFabric', '6b4a8a', 0.9)
_g = M['glass'].node_tree.nodes['Principled BSDF']; _g.inputs['Alpha'].default_value = 0.42; M['glass'].surface_render_method = 'BLENDED'
M['floor'] = mat('Floor', '2a2b2e', 0.95)
M['skin'] = mat('Skin', '8f6446', 0.6)
M['shirt'] = mat('Shirt', '3f6587', 0.8)
M['hair'] = mat('Hair', '1d1712', 0.7)
M['curtain'] = mat('Curtain', 'e9d9b5', 0.9)

L, W = 3.4, 1.44
hw, f = W / 2, L / 2
WF, WR, WZ, AR, TR = 1.05, -1.02, 0.27, 0.33, 0.27

root = bpy.data.objects.new('Van', None); col.objects.link(root)

prof = [(f, 0.34), (f + 0.03, 0.62), (f - 0.02, 0.98), (1.50, 1.06), (1.02, 1.78), (0.85, 1.84), (-f + 0.08, 1.86),
        (-f, 1.76), (-f, 0.34)] + arch(WR, WZ, AR) + arch(WF, WZ, AR)
body = bevel(extrude('Shell', prof, hw, [M['paint'], M['glass']], face_mat=lambda i: 1 if i == 3 else 0,
                     top_scale=(1.1, 1.86, 0.94)), 0.06, 3)
xs = lambda z: hw * (1 - 0.06 * min(1, max(0, (z - 1.1) / 0.76))) + 0.006
parts = [body]
for s in (1, -1):
    parts.append(panel([(1.40, 1.12), (0.98, 1.72), (0.56, 1.72), (0.56, 1.12)], xs, M['glass'], s))
    parts.append(panel([(0.44, 1.14), (0.44, 1.73), (-0.52, 1.74), (-0.52, 1.14)], xs, M['glass'], s))
    parts.append(panel([(-0.62, 1.14), (-0.62, 1.74), (-1.56, 1.75), (-1.56, 1.14)], xs, M['glass'], s))
    parts.append(panel([(f - 0.05, 0.96), (-f + 0.05, 0.96), (-f + 0.05, 1.02), (f - 0.05, 1.02)], lambda z: hw + 0.008, M['black'], s))
    parts.append(panel([(0.55, 0.40), (0.47, 1.76), (0.45, 1.76), (0.53, 0.40)], lambda z: hw + 0.007, M['black'], s))   # door seam
    parts.append(box(s * (hw - 0.04), s * (hw + 0.07), -0.62, 0.62, 0.31, 0.36, M['chrome'], 0.01))                  # side step
    parts.append(box(s * (hw - 0.01), s * (hw + 0.012), 0.30, 0.42, 1.0, 1.04, M['chrome']))                          # handles
    parts.append(box(s * (hw - 0.01), s * (hw + 0.012), -0.4, -0.28, 1.0, 1.04, M['chrome']))
    parts.append(box(s * 0.40, s * 0.64, f - 0.01, f + 0.05, 0.66, 0.84, M['head'], 0.015))                            # square lamps
    parts.append(box(s * 0.36, s * 0.68, f - 0.02, f + 0.035, 0.63, 0.87, M['chrome'], 0.01))
    parts.append(box(s * 0.56, s * 0.68, f, f + 0.06, 0.52, 0.60, M['amber'], 0.01))
    parts.append(box(s * (hw - 0.16), s * (hw - 0.02), -f - 0.04, -f + 0.02, 0.50, 0.98, M['tail'], 0.015))           # tall tail lamps
    parts.append(box(s * (hw - 0.02), s * (hw + 0.16), 1.30, 1.34, 1.18, 1.2, M['black']))                             # mirror arm
    parts.append(box(s * (hw + 0.12), s * (hw + 0.2), 1.26, 1.36, 1.12, 1.32, M['chrome'], 0.02))                     # mirror
    for y in (0.42, -0.6):  # curtains in the passenger windows
        parts.append(box(s * (hw - 0.09), s * (hw - 0.05), y - 0.2, y - 0.02, 1.16, 1.70, M['curtain'], 0.02))
parts.append(box(-0.34, 0.34, f, f + 0.04, 0.64, 0.86, M['black'], 0.01))                                              # grille
for z in (0.68, 0.74, 0.80):
    parts.append(box(-0.32, 0.32, f + 0.04, f + 0.055, z, z + 0.025, M['chrome']))
parts.append(box(-hw - 0.02, hw + 0.02, f - 0.06, f + 0.12, 0.32, 0.48, M['black'], 0.04))                             # bumpers
parts.append(box(-hw + 0.1, hw - 0.1, f + 0.1, f + 0.13, 0.36, 0.44, M['chrome'], 0.01))
parts.append(box(-hw - 0.02, hw + 0.02, -f - 0.12, -f + 0.06, 0.32, 0.46, M['black'], 0.04))
parts.append(box(-0.6, 0.6, -f - 0.012, -f + 0.01, 1.14, 1.72, M['glass']))                                            # rear glass
parts.append(box(-0.66, 0.66, 0.78, 1.0, 1.84, 1.9, M['black'], 0.02))                                                  # sun visor
parts.append(box(-0.6, 0.6, -1.4, 0.6, 1.86, 1.92, M['steel']))                                                        # roof rack
for y in (-1.3, -0.4, 0.5):
    parts.append(box(-0.62, 0.62, y, y + 0.05, 1.92, 1.96, M['chrome']))
# interior: floor, driver seat, two benches of three
parts.append(box(-hw + 0.06, hw - 0.06, -f + 0.1, f - 0.25, 0.36, 0.40, M['floor']))
parts.append(box(-0.12, 0.62, 0.62, 1.02, 0.40, 0.70, M['seat'], 0.03))
parts.append(box(-0.12, 0.62, 0.55, 0.66, 0.70, 1.30, M['seat'], 0.03))
for y in (0.0, -0.95):
    parts.append(box(-hw + 0.08, hw - 0.08, y - 0.18, y + 0.24, 0.40, 0.62, M['seat'], 0.03))
    parts.append(box(-hw + 0.08, hw - 0.08, y - 0.28, y - 0.16, 0.62, 1.22, M['seat'], 0.03))
# driver (right-hand side is the passenger door side in Egypt; driver sits left)
parts.append(cyl(0.17, 0.5, (0.25, 0.78, 0.98), M['shirt'], axis='Z', seg=14))
parts.append(cyl(0.11, 0.24, (0.25, 0.78, 1.36), M['skin'], axis='Z', seg=14))
parts.append(cyl(0.115, 0.06, (0.25, 0.78, 1.49), M['hair'], axis='Z', seg=14))
parts.append(cyl(0.19, 0.04, (0.25, 1.15, 1.08), M['black'], axis='Y', seg=20))                                        # steering wheel
parts.append(box(-0.1, 0.1, f + 0.12, f + 0.14, 0.36, 0.46, M['plate']))
parts.append(box(-0.2, 0.2, -f - 0.04, -f - 0.02, 0.52, 0.64, M['plate']))
b = finish('Body', parts); b.parent = root

def wheel_obj(name, loc, side, steer_parent=None):
    ps = wheel(0, side * 1e-4, TR, 0.17, z=0, rim_r=0.17)   # built at the origin, rim facing outwards
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
plate = bpy.data.objects.new('PlateR', None); col.objects.link(plate); plate.parent = root; plate.location = (0, -f - 0.05, 0.58)
slog = bpy.data.objects.new('SloganPt', None); col.objects.link(slog); slog.parent = root; slog.location = (0, -f - 0.02, 1.05)

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
