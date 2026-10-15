"""Girih ornaments for Ribat, built with Hankin's polygons-in-contact method. Run: python3 generate.py"""
import math, os
OUT = os.path.dirname(os.path.abspath(__file__))

def reg(cx, cy, R, n, rot):
    return [(cx + R*math.cos(math.radians(rot + 360*k/n)), cy + R*math.sin(math.radians(rot + 360*k/n))) for k in range(n)]

def rotate(v, deg):
    a = math.radians(deg); c, s = math.cos(a), math.sin(a)
    return (v[0]*c - v[1]*s, v[0]*s + v[1]*c)

def intersect(p, d, q, e):
    den = d[0]*e[1] - d[1]*e[0]
    t = ((q[0]-p[0])*e[1] - (q[1]-p[1])*e[0]) / den
    return (p[0] + t*d[0], p[1] + t*d[1])

def hankin(poly, theta):
    """Segments midpoint -> contact point -> next midpoint, for every vertex of a convex polygon."""
    n = len(poly)
    cx = sum(p[0] for p in poly)/n; cy = sum(p[1] for p in poly)/n
    mids, dirs = [], []
    for k in range(n):
        a, b = poly[k], poly[(k+1) % n]
        m = ((a[0]+b[0])/2, (a[1]+b[1])/2)
        u = (b[0]-a[0], b[1]-a[1]); L = math.hypot(*u); u = (u[0]/L, u[1]/L)
        # pick the rotation sign that points inside
        fwd = rotate(u, theta)
        if (fwd[0]*(cx-m[0]) + fwd[1]*(cy-m[1])) < 0: fwd = rotate(u, -theta)
        back = rotate((-u[0], -u[1]), -theta)
        if (back[0]*(cx-m[0]) + back[1]*(cy-m[1])) < 0: back = rotate((-u[0], -u[1]), theta)
        mids.append(m); dirs.append((fwd, back))
    paths = []
    for k in range(n):
        j = (k+1) % n
        p = intersect(mids[k], dirs[k][0], mids[j], dirs[j][1])
        paths.append([mids[k], p, mids[j]])
    return paths

def d_of(paths):
    return ''.join('M' + ' L'.join(f'{x:.2f} {y:.2f}' for x, y in pts) for pts in paths)

def band_svg(w, h, d, outer, inner, extra=''):
    """Doubled line: a wide stroke with a narrower one cut out, so lines read as interlace bands."""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
            f'<defs><mask id="b" maskUnits="userSpaceOnUse" x="0" y="0" width="{w}" height="{h}">'
            f'<path d="{d}" fill="none" stroke="#fff" stroke-width="{outer}" stroke-linejoin="miter"/>'
            f'<path d="{d}" fill="none" stroke="#000" stroke-width="{inner}" stroke-linejoin="miter"/></mask></defs>'
            f'<rect width="{w}" height="{h}" fill="#000" mask="url(#b)"/>{extra}</svg>')

def write(name, svg):
    open(os.path.join(OUT, name), 'w').write(svg); print(name, len(svg))

# 1. Lattice on the 4.8.8 tiling: octagons give 8-point stars, squares give the crosses between them.
e = 40.0
d = e * (1 + math.sqrt(2))            # period
R8 = e / (2*math.sin(math.radians(22.5)))
R4 = e / math.sqrt(2)
paths = []
for i in range(-1, 2):
    for j in range(-1, 2):
        paths += hankin(reg(i*d, j*d, R8, 8, 22.5), 67.5)
        paths += hankin(reg(i*d + d/2, j*d + d/2, R4, 4, 0), 67.5)
write('lattice.svg', band_svg(round(d, 2), round(d, 2), d_of(paths), 2.4, 0.9))

# 2. Shamsa: a 16-point rosette inside an 8-point one, framed by a double ring.
M = 400; m = M/2
paths = hankin(reg(m, m, m*0.86, 16, 0), 72) + hankin(reg(m, m, m*0.50, 8, 22.5), 67.5)
paths += hankin(reg(m, m, m*0.20, 8, 0), 60)
ring = ''.join(f'<circle cx="{m}" cy="{m}" r="{r:.1f}" fill="none" stroke="#000" stroke-width="{w}"/>'
               for r, w in [(m*0.985, 2.2), (m*0.94, 1.2), (m*0.88, 1.2)])
dots = ''.join(f'<circle cx="{m + m*0.912*math.cos(math.radians(k*22.5+11.25)):.1f}" cy="{m + m*0.912*math.sin(math.radians(k*22.5+11.25)):.1f}" r="3" fill="#000"/>' for k in range(16))
write('shamsa.svg', band_svg(M, M, d_of(paths), 5, 2, ring + dots))

# 3. Frieze: a running chain of small khatams between two rules.
W, H = 30, 14
paths = hankin(reg(W/2, H/2, 6.2, 8, 22.5), 67.5)
x = f'<path d="M0 1H{W}M0 {H-1}H{W}" stroke="#000" stroke-width="1"/>' \
    f'<path d="{d_of(paths)}" fill="none" stroke="#000" stroke-width="1.1"/>' \
    f'<path d="M0 {H/2}H3M{W-3} {H/2}H{W}" stroke="#000" stroke-width="1"/>'
write('frieze-x.svg', f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">{x}</svg>')
y = x.replace(f'M0 1H{W}M0 {H-1}H{W}', f'M1 0V{W}M{H-1} 0V{W}').replace(f'M0 {H/2}H3M{W-3} {H/2}H{W}', f'M{H/2} 0V3M{H/2} {W-3}V{W}')
paths_y = hankin(reg(H/2, W/2, 6.2, 8, 22.5), 67.5)
y = y.replace(d_of(paths), d_of(paths_y))
write('frieze-y.svg', f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {H} {W}" width="{H}" height="{W}">{y}</svg>')
