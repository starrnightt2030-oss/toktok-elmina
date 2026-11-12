"""Arabic text -> SVG path data, shaped with HarfBuzz (correct joining) and drawn from the font outlines."""
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.varLib.instancer import instantiateVariableFont
import functools, io

@functools.lru_cache(None)
def load(path, wght=None):
    tt = TTFont(path)
    if wght and 'fvar' in tt:
        tt = instantiateVariableFont(tt, {'wght': wght})
    buf = io.BytesIO(); tt.save(buf); data = buf.getvalue()
    return TTFont(io.BytesIO(data)), data

def shape(path, text, size, wght=None, x=0, y=0, tracking=0):
    """returns (d, width, ascent, descent) ; (x,y) = baseline left point"""
    tt, data = load(path, wght)
    face = hb.Face(data); font = hb.Font(face); upem = face.upem
    buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    hb.shape(font, buf, {"kern": True, "liga": True})
    gs = tt.getGlyphSet(); order = tt.getGlyphOrder(); s = size / upem
    pen = SVGPathPen(gs); cx = 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        tp = TransformPen(pen, (s, 0, 0, -s, x + (cx + pos.x_offset) * s, y - pos.y_offset * s))
        gs[name].draw(tp); cx += pos.x_advance + tracking
    hhea = tt['hhea']
    return pen.getCommands(), cx * s, hhea.ascent * s, -hhea.descent * s

def glyphs(path, text, size, wght=None):
    """per-glyph (d at origin, advance) in visual order — for placing along a curve"""
    tt, data = load(path, wght)
    face = hb.Face(data); font = hb.Font(face); upem = face.upem
    buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    hb.shape(font, buf, {})
    gs = tt.getGlyphSet(); order = tt.getGlyphOrder(); s = size / upem; out = []
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        pen = SVGPathPen(gs); tp = TransformPen(pen, (s, 0, 0, -s, pos.x_offset * s, -pos.y_offset * s))
        gs[order[info.codepoint]].draw(tp); out.append((pen.getCommands(), pos.x_advance * s))
    return out
