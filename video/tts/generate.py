"""Voice for the Ribat video: one edge-tts clip per script line, durations into src/lines.json.

Run from video/: uv run --with edge-tts python3 tts/generate.py
"""
import asyncio, json, re, subprocess
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT.parent / 'docs/video/script.md'
VOICE, RATE = 'ar-SY-LaithNeural', '-8%'


def lines():
    scene = None
    for raw in SCRIPT.read_text(encoding='utf8').splitlines():
        if m := re.match(r'## (\d+) ·', raw):
            scene = int(m.group(1))
        cells = [c.strip() for c in raw.strip().strip('|').split('|')]
        if scene is None or not re.fullmatch(r'\d+\.\d+', cells[0]):
            continue
        # Rows are "# | voiceover | subtitle" or "# | screen | voiceover | subtitle".
        yield {'id': cells[0], 'scene': scene, 'ar': cells[-2], 'en': cells[-1]}


def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                         capture_output=True, text=True, check=True)
    return round(float(out.stdout), 3)


async def main():
    rows = list(lines())
    for row in rows:
        out = ROOT / 'public/vo' / f"{row['id']}.mp3"
        # The Arabic voice cannot say the honorific glyph; the script spells it out already.
        await edge_tts.Communicate(row['ar'].replace('«', '').replace('»', ''), VOICE, rate=RATE).save(str(out))
        row['seconds'] = duration(out)
        print(row['id'], row['seconds'])
    (ROOT / 'src/lines.json').write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding='utf8')
    print('total speech', round(sum(r['seconds'] for r in rows), 1), 's in', len(rows), 'lines')


asyncio.run(main())
