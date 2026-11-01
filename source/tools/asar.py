"""Pack or unpack an Electron app.asar without Node (python3 asar.py pack <dir> <out.asar> | extract <in.asar> <dir>)."""
import json, struct, sys, os

def pack(src, out):
    blobs, offset = [], 0
    def walk(d):
        nonlocal offset
        node = {'files': {}}
        for name in sorted(os.listdir(d)):
            p = os.path.join(d, name)
            if os.path.isdir(p): node['files'][name] = walk(p)
            else:
                data = open(p, 'rb').read()
                ent = {'size': len(data), 'offset': str(offset)}
                if os.access(p, os.X_OK) and not name.endswith(('.js', '.html', '.css', '.png', '.json')): ent['executable'] = True
                node['files'][name] = ent; blobs.append(data); offset += len(data)
        return node
    j = json.dumps(walk(src), separators=(',', ':')).encode()
    pad = (4 - len(j) % 4) % 4
    buf2 = struct.pack('<II', 4 + len(j) + pad, len(j)) + j + b'\0' * pad
    with open(out, 'wb') as f:
        f.write(struct.pack('<II', 4, len(buf2)) + buf2)
        for b in blobs: f.write(b)

def extract(asar, out):
    f = open(asar, 'rb'); d = f.read(16)
    hsize = struct.unpack('<I', d[4:8])[0]; jlen = struct.unpack('<I', d[12:16])[0]
    header = json.loads(f.read(jlen)); base = 8 + hsize
    def walk(node, p):
        for name, n in node['files'].items():
            q = os.path.join(p, name)
            if 'files' in n: os.makedirs(q, exist_ok=True); walk(n, q)
            elif 'link' in n or n.get('unpacked'): pass
            else: f.seek(base + int(n['offset'])); open(q, 'wb').write(f.read(n['size']))
    os.makedirs(out, exist_ok=True); walk(header, out)

if __name__ == '__main__':
    {'pack': pack, 'extract': extract}[sys.argv[1]](sys.argv[2], sys.argv[3])
