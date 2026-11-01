"""Replace the icon images inside a Windows .exe in place (each new image must fit in the old slot)."""
import struct, sys, io
from PIL import Image

def rd(fmt, b, o): return struct.unpack_from(fmt, b, o)

def resources(pe):
    e = rd('<I', pe, 0x3c)[0]; nsec = rd('<H', pe, e + 6)[0]; optsz = rd('<H', pe, e + 20)[0]
    opt = e + 24; magic = rd('<H', pe, opt)[0]
    ddir = opt + (112 if magic == 0x20b else 96)
    rsrc_rva = rd('<I', pe, ddir + 2 * 8)[0]
    secs = []
    so = opt + optsz
    for i in range(nsec):
        s = so + 40 * i
        vs, va, rs, ra = rd('<IIII', pe, s + 8)
        secs.append((va, max(vs, rs), ra))
    def off(rva):
        for va, sz, ra in secs:
            if va <= rva < va + sz: return rva - va + ra
        raise ValueError(hex(rva))
    base = off(rsrc_rva)
    out = {}
    def walk(o, path):
        n1, n2 = rd('<HH', pe, o + 12)
        for i in range(n1 + n2):
            name, ptr = rd('<II', pe, o + 16 + 8 * i)
            if ptr & 0x80000000: walk(base + (ptr & 0x7fffffff), path + [name])
            else:
                de = base + ptr
                rva, size = rd('<II', pe, de)
                out.setdefault(path[0], []).append((path[1], de, off(rva), size))
    walk(base, [])
    return out

def main(exe, png):
    pe = bytearray(open(exe, 'rb').read())
    res = resources(pe)
    icons = {i: (de, o, sz) for i, de, o, sz in res[3]}
    gid, gde, go, gsz = res[14][0]
    cnt = rd('<H', pe, go + 4)[0]
    src = Image.open(png).convert('RGBA')
    for k in range(cnt):
        ent = go + 6 + 14 * k
        w, h = pe[ent], pe[ent + 1]; w = w or 256; h = h or 256
        nid = rd('<H', pe, ent + 12)[0]
        de, o, old = icons[nid]
        img = src.resize((w, h), Image.LANCZOS)
        b = io.BytesIO(); img.save(b, 'PNG', optimize=True); data = b.getvalue()
        if len(data) > old:
            b = io.BytesIO(); img.quantize(256, method=Image.Quantize.FASTOCTREE).save(b, 'PNG', optimize=True); data = b.getvalue()
        if len(data) > old and w >= 256:
            b = io.BytesIO(); img.resize((192,192), Image.LANCZOS).resize((256,256), Image.NEAREST).quantize(128).save(b, 'PNG', optimize=True); data = b.getvalue()
        if len(data) > old and w < 256:
            # fall back to a BMP-style DIB, which is what small slots hold
            ico = io.BytesIO(); img.save(ico, 'ICO', sizes=[(w, h)]); raw = ico.getvalue()
            data = raw[rd('<I', raw, 18)[0]:]
        if len(data) > old: print('skip', w, len(data), old); continue
        pe[o:o + old] = data + b'\0' * (old - len(data))
        struct.pack_into('<I', pe, de + 4, len(data))
        struct.pack_into('<I', pe, ent + 8, len(data))
        struct.pack_into('<H', pe, ent + 6, 32)
        print('icon', w, 'x', h, len(data), '/', old)
    open(exe, 'wb').write(pe)

main(sys.argv[1], sys.argv[2])
