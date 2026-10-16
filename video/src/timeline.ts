// Lays the whole film out in seconds: generated scenes, role title cards and the recordings,
// with every voice clip and tap placed where the recorder logged it.
import lines from './lines.json';
import sheikh from '../public/rec/sheikh.json';
import teacher from '../public/rec/teacher.json';
import teacher2 from '../public/rec/teacher2.json';
import student from '../public/rec/student.json';
import father from '../public/rec/father.json';
import themes from '../public/rec/themes.json';

export const FPS = 30;

export type Box = { x: number; y: number; width: number; height: number };
export type Rec = {
  role: string;
  device: { width: number; height: number; scale: number };
  t0: number;
  end: number;
  lines: { id: string; t: number }[];
  clicks: number[];
  zooms: { t: number; seconds: number; scale: number; box: Box }[];
};
export type Voice = { id: string; at: number; dur: number; sub: string };
export type Segment =
  | { kind: 'open' | 'name' | 'tech' | 'close'; at: number; dur: number }
  | { kind: 'title'; ar: string; en: string; at: number; dur: number }
  | { kind: 'rec'; rec: Rec; phone: boolean; at: number; dur: number };

const byId = new Map(lines.map((l) => [l.id, l]));

export function buildTimeline() {
  const segments: Segment[] = [];
  const voices: Voice[] = [];
  const clicks: number[] = [];
  let cursor = 0;

  const voice = (id: string, at: number) => {
    const line = byId.get(id);
    if (!line) throw new Error(`No voice line ${id}`);
    voices.push({ id, at, dur: line.seconds, sub: line.sub });
    return line.seconds;
  };
  // Generated scenes: lines one after another with a breath between them.
  const generated = (kind: 'open' | 'name' | 'tech' | 'close', ids: string[], lead = 1.2, tail = 1.2) => {
    const at = cursor;
    let t = at + lead;
    ids.forEach((id, i) => {
      t += voice(id, t) + (i < ids.length - 1 ? 0.9 : 0);
    });
    cursor = t + tail;
    segments.push({ kind, at, dur: cursor - at });
  };
  const title = (ar: string, en: string, dur = 2.4) => {
    segments.push({ kind: 'title', ar, en, at: cursor, dur });
    cursor += dur;
  };
  const recording = (rec: Rec, phone: boolean) => {
    const at = cursor;
    const dur = rec.end - rec.t0;
    for (const l of rec.lines) voice(l.id, at + l.t - rec.t0);
    for (const c of rec.clicks) clicks.push(at + c - rec.t0);
    segments.push({ kind: 'rec', rec, phone, at, dur });
    cursor += dur;
  };

  generated('open', ['0.1', '0.2', '0.3'], 2);
  generated('name', ['1.1', '1.2'], 1.4, 1.4);
  title('الشيخ', 'The sheikh');
  recording(sheikh as Rec, false);
  title('المعلّم', 'The teacher · class mode');
  recording(teacher as Rec, true);
  recording(teacher2 as Rec, true);
  title('الطالب', 'The student');
  recording(student as Rec, true);
  title('وليّ الأمر', 'The parent');
  recording(father as Rec, true);
  title('صُنع للمسجد', 'Made for the mosque');
  recording(themes as Rec, false);
  generated('tech', ['7.1', '7.2', '7.3', '7.4', '7.5'], 1.2, 1.6);
  generated('close', ['8.1', '8.2'], 1.2, 3.5);

  return { segments, voices, clicks, seconds: cursor };
}
