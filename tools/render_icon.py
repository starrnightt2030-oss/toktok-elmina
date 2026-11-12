"""Render the tuk-tuk model for the app icon: python3 tools/render_icon.py public/models/tuk.glb out.png"""
import bpy, sys, math
from mathutils import Vector
src, out = sys.argv[1], sys.argv[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scn = bpy.context.scene
w = bpy.data.worlds.new('W'); scn.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (1, 1, 1, 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
sun = bpy.data.lights.new('S', 'SUN'); sun.energy = 4; so = bpy.data.objects.new('S', sun); so.rotation_euler = (math.radians(45), 0, math.radians(-40)); scn.collection.objects.link(so)
cam = bpy.data.cameras.new('C'); cam.lens = 50; co = bpy.data.objects.new('C', cam); scn.collection.objects.link(co); scn.camera = co
co.location = (3.3, 4.4, 1.9); co.rotation_euler = (Vector((0, 0, 0.85)) - co.location).to_track_quat('-Z', 'Y').to_euler()
scn.render.engine = 'CYCLES'; scn.cycles.samples = 48; scn.render.film_transparent = True
scn.render.resolution_x = scn.render.resolution_y = 640; scn.render.filepath = out
bpy.ops.render.render(write_still=True)
