import { Audio, Video } from '@remotion/media';
import { loadFont as loadAmiri } from '@remotion/google-fonts/Amiri';
import { loadFont as loadKufi } from '@remotion/google-fonts/ReemKufi';
import { loadFont as loadPlex } from '@remotion/google-fonts/IBMPlexSans';
import { useEffect, useState } from 'react';
import {
  AbsoluteFill,
  Easing,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { FPS, buildTimeline, type Rec, type Segment, type Voice } from './timeline';

const amiri = loadAmiri('normal', { weights: ['400', '700'], subsets: ['arabic'] }).fontFamily;
const kufi = loadKufi('normal', { weights: ['600'], subsets: ['arabic', 'latin'] }).fontFamily;
const plex = loadPlex('normal', { weights: ['400', '500', '600'], subsets: ['latin'] }).fontFamily;

// The app's own palette (apps/web/src/index.css, theme زمرد).
const C = { chrome: '#0a4a2b', deep: '#063820', gold: '#d4a94a', paper: '#f1f6f2', muted: '#b9d6c4' };
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const f = (s: number) => Math.round(s * FPS);

export const timeline = buildTimeline();

export const Film = () => (
  <AbsoluteFill style={{ background: C.deep }}>
    {timeline.segments.map((seg, i) => (
      <Sequence key={i} from={f(seg.at)} durationInFrames={f(seg.dur)} premountFor={FPS}>
        <SegmentView seg={seg} voices={timeline.voices.filter((v) => v.at >= seg.at && v.at < seg.at + seg.dur)} />
      </Sequence>
    ))}
    {timeline.voices.map((v) => (
      <Audio key={v.id} from={f(v.at)} src={staticFile(`vo/${v.id}.mp3`)} />
    ))}
    {timeline.clicks.map((t, i) => (
      <Audio key={`c${i}`} from={f(t)} src={staticFile('sfx/click.wav')} volume={0.3} />
    ))}
    <Captions voices={timeline.voices} />
  </AbsoluteFill>
);

function SegmentView({ seg, voices }: { seg: Segment; voices: Voice[] }) {
  const local = voices.map((v) => ({ ...v, at: v.at - seg.at }));
  switch (seg.kind) {
    case 'open':
      return <Open dur={seg.dur} />;
    case 'name':
      return <Name voices={local} />;
    case 'title':
      return <Title ar={seg.ar} en={seg.en} dur={seg.dur} />;
    case 'rec':
      return seg.phone ? <Phone rec={seg.rec} /> : <Desktop rec={seg.rec} />;
    case 'tech':
      return <Tech dur={seg.dur} />;
    case 'close':
      return <Close dur={seg.dur} />;
  }
}

// ---------------------------------------------------------------------------
// Ornament

/** Emerald ground with the app's girih lattice in gold, drifting very slowly. */
function Field({ opacity = 0.12 }: { opacity?: number }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, ${C.chrome}, ${C.deep} 75%)` }}>
      <AbsoluteFill
        style={{
          background: C.gold,
          opacity,
          maskImage: `url(${staticFile('ornaments/lattice.svg')})`,
          maskSize: '150px',
          maskPosition: `${frame * 0.15}px ${frame * 0.08}px`,
        }}
      />
    </AbsoluteFill>
  );
}

function useSvg(file: string) {
  const [text, setText] = useState<string | null>(null);
  const [handle] = useState(() => delayRender(file));
  useEffect(() => {
    fetch(staticFile(file))
      .then((r) => r.text())
      .then((t) => {
        setText(t);
        continueRender(handle);
      });
  }, [file, handle]);
  return text;
}

/** The shamsa drawn stroke by stroke: the SVG becomes a mask over a gold fill, with dashes set per frame. */
function Shamsa({ size, progress = 1, rotate = 0, opacity = 1 }: { size: number; progress?: number; rotate?: number; opacity?: number }) {
  const svg = useSvg('ornaments/shamsa.svg');
  if (!svg) return null;
  const dash = ` pathLength="1" stroke-dasharray="1" stroke-dashoffset="${(1 - progress).toFixed(4)}" `;
  const drawn = svg.replaceAll('<path ', `<path${dash}`).replaceAll('<circle cx', `<circle${dash}cx`);
  return (
    <div
      style={{
        width: size,
        height: size,
        background: C.gold,
        opacity,
        transform: `rotate(${rotate}deg)`,
        maskImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(drawn)}")`,
        maskSize: 'contain',
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Generated scenes

function Open({ dur }: { dur: number }) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [f(0.6), f(dur - 2)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const out = interpolate(frame, [f(dur - 0.8), f(dur)], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Field opacity={interpolate(frame, [0, f(4)], [0, 0.1], clamp)} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Shamsa size={760} progress={progress} rotate={frame * 0.03} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function Name({ voices }: { voices: Voice[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nameAt = f(voices.find((v) => v.id === '1.2')!.at);
  const hadith = ['وكثرةُ الخُطا إلى المساجد،', 'وانتظارُ الصلاةِ بعد الصلاة،', 'فذلكم الرِّباط'];
  const hadithOut = interpolate(frame, [nameAt - 12, nameAt], [1, 0], clamp);
  const mark = spring({ frame: frame - nameAt, fps, config: { damping: 18, mass: 0.9 } });
  return (
    <AbsoluteFill>
      <Field />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Shamsa size={980} rotate={frame * 0.02} opacity={0.18} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 28, opacity: hadithOut, direction: 'rtl' }}>
        <div style={{ fontFamily: amiri, fontSize: 44, color: C.muted }}>قال رسولُ الله ﷺ</div>
        {hadith.map((line, i) => (
          <div
            key={line}
            style={{
              fontFamily: amiri,
              fontWeight: 700,
              fontSize: i === 2 ? 96 : 76,
              color: i === 2 ? C.gold : C.paper,
              opacity: interpolate(frame, [f(1.2 + i * 2.2), f(2 + i * 2.2)], [0, 1], clamp),
            }}
          >
            {line}
          </div>
        ))}
        <div style={{ fontFamily: amiri, fontSize: 36, color: C.muted, opacity: interpolate(frame, [f(7), f(8)], [0, 1], clamp) }}>
          رواه مسلم
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: mark, transform: `scale(${0.92 + mark * 0.08})` }}>
        <div style={{ fontFamily: kufi, fontSize: 260, color: C.gold, lineHeight: 1 }}>رباط</div>
        <div style={{ fontFamily: plex, fontSize: 40, letterSpacing: 6, color: C.muted, marginTop: 24 }}>Ribat</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function Title({ ar, en, dur }: { ar: string; en: string; dur: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 20 } });
  const out = interpolate(frame, [f(dur - 0.5), f(dur)], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Field />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 20, opacity: enter, transform: `translateY(${(1 - enter) * 30}px)` }}>
        <div style={{ fontFamily: kufi, fontSize: 150, color: C.gold }}>{ar}</div>
        <div style={{ fontFamily: plex, fontSize: 38, color: C.muted, letterSpacing: 2 }}>{en}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

const STACK = [
  'NestJS 11 · PostgreSQL 16 · Prisma · Redis · BullMQ',
  'React 19 · Vite PWA · Dexie (IndexedDB) · Tailwind CSS 4',
  'Zod contracts shared by the API and the app',
  'Every tenant route answers 404 to another mosque: 19 reads, 12 writes',
  '200 offline changes synced in one request in under 2 s',
  'Open source · AGPL-3.0',
];

function Tech({ dur }: { dur: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const step = (dur - 3) / STACK.length;
  return (
    <AbsoluteFill>
      <Field opacity={0.08} />
      <AbsoluteFill style={{ padding: '120px 160px 200px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignContent: 'center' }}>
        {STACK.map((text, i) => {
          const s = spring({ frame: frame - f(0.8 + i * step), fps, config: { damping: 20 } });
          return (
            <div
              key={text}
              style={{
                opacity: s,
                transform: `translateY(${(1 - s) * 24}px)`,
                background: 'rgba(241,246,242,0.06)',
                border: `1px solid rgba(212,169,74,0.35)`,
                borderRadius: 18,
                padding: '30px 34px',
                fontFamily: plex,
                fontWeight: 500,
                fontSize: 34,
                lineHeight: 1.35,
                color: i >= 3 ? C.gold : C.paper,
              }}
            >
              {text}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function Close({ dur }: { dur: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 22 } });
  const out = interpolate(frame, [f(dur - 1.2), f(dur)], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Field />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Shamsa size={900} rotate={frame * 0.03} opacity={0.22} progress={interpolate(frame, [0, f(3)], [0.4, 1], clamp)} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 26, opacity: enter }}>
        <div style={{ fontFamily: kufi, fontSize: 230, color: C.gold, lineHeight: 1 }}>رباط</div>
        <div style={{ fontFamily: amiri, fontSize: 54, color: C.paper, direction: 'rtl', marginTop: 36 }}>لأنّ كلَّ آيةٍ تُحفَظ، تستحقُّ أن تُحفَظ</div>
        <div style={{ fontFamily: plex, fontSize: 32, color: C.muted, marginTop: 30 }}>github.com/Salad-man3/ribat</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Recordings

/** Push in on the element the line is about: ease in, hold, ease out. */
function zoomAt(rec: Rec, t: number, toDisplay: number) {
  for (const z of rec.zooms) {
    const end = z.t + z.seconds;
    if (t < z.t - 0.1 || t > end + 0.7) continue;
    const k = interpolate(t, [z.t, z.t + 0.7, end, end + 0.7], [0, 1, 1, 0], { ...clamp, easing: Easing.inOut(Easing.quad) });
    return {
      scale: 1 + (z.scale - 1) * k,
      origin: `${(z.box.x + z.box.width / 2) * toDisplay}px ${(z.box.y + z.box.height / 2) * toDisplay}px`,
    };
  }
  return { scale: 1, origin: '50% 50%' };
}

function Recording({ rec, width, height }: { rec: Rec; width: number; height: number }) {
  const frame = useCurrentFrame();
  const t = rec.t0 + frame / FPS;
  const { scale, origin } = zoomAt(rec, t, width / rec.device.width);
  return (
    <div style={{ width, height, overflow: 'hidden', position: 'relative' }}>
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: origin }}>
        <Video src={staticFile(`rec/${rec.role}.mp4`)} trimBefore={f(rec.t0)} muted style={{ width, height }} />
      </div>
    </div>
  );
}

function Desktop({ rec }: { rec: Rec }) {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 10], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Recording rec={rec} width={1920} height={1080} />
    </AbsoluteFill>
  );
}

const ROLE_LABEL: Record<string, [string, string]> = {
  teacher: ['المعلّم', 'Class mode, on the teacher’s phone'],
  teacher2: ['المعلّم', 'An explanation lesson'],
  student: ['الطالبة', 'Her own progress'],
  father: ['وليّ الأمر', 'His own children, nothing else'],
};

function Phone({ rec }: { rec: Rec }) {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 10], [0, 1], clamp);
  const screenH = 880;
  const screenW = Math.round((rec.device.width / rec.device.height) * screenH);
  const [ar, en] = ROLE_LABEL[rec.role] ?? ['', ''];
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Field opacity={0.09} />
      <div
        style={{
          position: 'absolute',
          left: 520 - screenW / 2,
          top: (1080 - screenH) / 2 - 40,
          padding: 14,
          borderRadius: 58,
          background: '#0b0f0d',
          boxShadow: '0 40px 90px rgba(0,0,0,0.45), 0 0 0 2px rgba(212,169,74,0.35)',
        }}
      >
        <div style={{ borderRadius: 44, overflow: 'hidden' }}>
          <Recording rec={rec} width={screenW} height={screenH} />
        </div>
      </div>
      <div style={{ position: 'absolute', right: 180, top: 360, width: 760, textAlign: 'right', direction: 'rtl' }}>
        <div style={{ fontFamily: kufi, fontSize: 132, color: C.gold, lineHeight: 1.1 }}>{ar}</div>
        <div style={{ fontFamily: plex, fontSize: 36, color: C.muted, marginTop: 18, direction: 'ltr' }}>{en}</div>
      </div>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// Captions: English, burned in, timed to each voice clip.

function Captions({ voices }: { voices: Voice[] }) {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const v = voices.find((x) => t >= x.at && t < x.at + x.dur + 0.35);
  if (!v) return null;
  const opacity = interpolate(t, [v.at, v.at + 0.2, v.at + v.dur + 0.15, v.at + v.dur + 0.35], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 54 }}>
      <div
        style={{
          opacity,
          maxWidth: 1360,
          padding: '14px 30px',
          borderRadius: 16,
          background: 'rgba(6,56,32,0.86)',
          color: '#fff',
          fontFamily: plex,
          fontSize: 40,
          lineHeight: 1.32,
          textAlign: 'center',
        }}
      >
        {v.en}
      </div>
    </AbsoluteFill>
  );
}
