import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AttendanceStatus,
  ClassKit,
  CourseHalaqaWall,
  CourseMaterialResponse,
  SessionAttendanceResponse,
} from '@ribat/shared';
import { apiFetch } from '../../api/api-fetch';
import { db } from '../../offline/db';
import { enqueue, useLive } from '../../offline/outbox';
import type { OutboxEntry } from '../../offline/db';

type KitSession = ClassKit['sessions'][number];

export type ClassSessionView =
  | { status: 'loading' }
  | { status: 'missing' }
  | {
      status: 'ready';
      mode: 'kit' | 'online';
      session: KitSession;
      kit: ClassKit;
      pending: OutboxEntry[];
      timezone: string;
    };

function wallStudentOf(wall: CourseHalaqaWall | undefined, memberId: string) {
  return wall?.students.find((s) => s.memberId === memberId);
}

function kitMaterialsFromLinks(
  links: CourseMaterialResponse[],
  courseId: string,
) {
  return links.map((l) => ({
    courseId,
    materialId: l.materialId,
    title: l.material.title,
    kind: l.material.kind,
    track: l.track,
    totalPages: l.material.totalPages,
  }));
}

/** Kit-first session view; falls back to live API for staff lobby opens. */
export function useClassSessionView(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  const kitLive = useLive(async () => {
    if (!sessionId) return null;
    const row = await db.kit.get('current');
    const kit = row?.kit;
    const session =
      kit?.sessions.find((s) => s.id === sessionId) ??
      row?.previous?.sessions.find((s) => s.id === sessionId);
    const source = kit?.sessions.some((s) => s.id === sessionId)
      ? kit
      : row?.previous;
    const courseId = session?.courseId;
    const pending = (await db.outbox.orderBy('queuedAt').toArray()).filter(
      (e) => {
        if (e.type === 'attendance.mark' || e.type === 'material.log')
          return e.payload.sessionId === sessionId;
        if (!courseId) return false;
        if (e.type === 'memorization.log' || e.type === 'memorization.test')
          return e.payload.courseId === courseId;
        return false;
      },
    );
    return { session, kit: source, pending };
  }, [sessionId]);

  const needsOnline =
    kitLive !== undefined &&
    kitLive !== null &&
    (!kitLive.session || !kitLive.kit);

  const online = useQuery({
    queryKey: ['session-attendance', sessionId],
    queryFn: () =>
      apiFetch<SessionAttendanceResponse>(
        `/api/v1/sessions/${sessionId}/attendance`,
      ),
    enabled: Boolean(sessionId && needsOnline),
    retry: false,
  });

  const courseId = online.data?.session.courseId;
  const wall = useQuery({
    queryKey: ['halaqa-wall', courseId],
    queryFn: () =>
      apiFetch<CourseHalaqaWall>(`/api/v1/courses/${courseId}/halaqa-wall`),
    enabled: Boolean(needsOnline && courseId),
  });

  const courseMaterials = useQuery({
    queryKey: ['course-materials', courseId],
    queryFn: () =>
      apiFetch<CourseMaterialResponse[]>(
        `/api/v1/courses/${courseId}/materials`,
      ),
    enabled: Boolean(needsOnline && courseId),
  });

  const refreshOnline = () => {
    void queryClient.invalidateQueries({
      queryKey: ['session-attendance', sessionId],
    });
    if (courseId) {
      void queryClient.invalidateQueries({
        queryKey: ['halaqa-wall', courseId],
      });
    }
  };

  const markOnline = async (enrollmentId: string, status: AttendanceStatus) => {
    if (!sessionId) return;
    await apiFetch(`/api/v1/sessions/${sessionId}/attendance`, {
      method: 'POST',
      body: JSON.stringify({
        marks: [
          {
            idempotencyKey: crypto.randomUUID(),
            enrollmentId,
            status,
          },
        ],
      }),
    });
    refreshOnline();
  };

  if (kitLive === undefined) {
    return {
      view: { status: 'loading' } as const,
      markOnline: undefined,
      refreshOnline: undefined,
    };
  }
  if (kitLive?.session && kitLive.kit) {
    return {
      view: {
        status: 'ready',
        mode: 'kit',
        session: kitLive.session,
        kit: kitLive.kit,
        pending: kitLive.pending,
        timezone: kitLive.kit.timezone,
      } satisfies ClassSessionView,
      markOnline: undefined,
      refreshOnline: undefined,
    };
  }

  if (needsOnline) {
    if (
      online.isPending ||
      (online.data && (wall.isPending || courseMaterials.isPending))
    ) {
      return {
        view: { status: 'loading' } as const,
        markOnline: undefined,
        refreshOnline: undefined,
      };
    }
    if (online.isError || !online.data) {
      return {
        view: { status: 'missing' } as const,
        markOnline: undefined,
        refreshOnline: undefined,
      };
    }
    const { session: s, roster } = online.data;
    const wallData = wall.data;
    const links = courseMaterials.data ?? [];
    const quranLink = links.find(
      (l) => l.track === 'MEMORIZATION' && l.material.kind === 'QURAN',
    );
    const memorizationMaterialId =
      quranLink?.materialId ??
      links.find((l) => l.track === 'MEMORIZATION')?.materialId;

    const syntheticSession: KitSession = {
      id: s.id,
      courseId: s.courseId,
      courseName: s.courseName,
      courseType: s.courseType,
      testPassMark: s.testPassMark,
      date: s.date,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      status: s.status,
      topic: s.topic,
      groupIds: [],
      roster: roster.map((r) => ({
        enrollmentId: r.enrollmentId,
        memberId: r.memberId,
        name: r.name,
        attendance: r.attendance?.status ?? null,
      })),
    };

    const positions = roster
      .map((r) => wallStudentOf(wallData, r.memberId)?.position)
      .filter((p): p is NonNullable<typeof p> => Boolean(p));

    const memberHifzMaps: ClassKit['memberHifzMaps'] = [];
    if (memorizationMaterialId) {
      for (const r of roster) {
        const w = wallStudentOf(wallData, r.memberId);
        if (w?.juzFills) {
          memberHifzMaps.push({
            memberId: r.memberId,
            materialId: memorizationMaterialId,
            juzMemorized: w.juzMemorized ?? [],
            juzFills: w.juzFills,
            lastLog: w.lastLog ?? null,
          });
        }
      }
    }

    const syntheticKit: ClassKit = {
      kitVersion: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
      date: s.date,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      memberId: '00000000-0000-0000-0000-000000000000',
      sessions: [syntheticSession],
      materials: kitMaterialsFromLinks(links, s.courseId),
      positions,
      todayLogs: [],
      explanationProgress: [],
      recitationKinds: [],
      memberHifzMaps,
    };

    for (const r of roster) {
      const w = wallStudentOf(wallData, r.memberId);
      if (
        w?.loggedToday &&
        memorizationMaterialId &&
        w.position?.lastPageReached
      ) {
        syntheticKit.todayLogs.push({
          id: `online-${r.memberId}`,
          memberId: r.memberId,
          materialId: memorizationMaterialId,
          type: 'NEW',
          pageFrom: w.position.lastPageReached,
          pageTo: w.position.lastPageReached,
          countsProgress: true,
          loggedAt: new Date().toISOString(),
        });
      }
    }

    return {
      view: {
        status: 'ready',
        mode: 'online',
        session: syntheticSession,
        kit: syntheticKit,
        pending: [],
        timezone: syntheticKit.timezone,
      } satisfies ClassSessionView,
      markOnline,
      refreshOnline,
    };
  }

  return {
    view: { status: 'missing' } as const,
    markOnline: undefined,
    refreshOnline: undefined,
  };
}

export function markAttendance(
  mode: 'kit' | 'online',
  sessionId: string,
  enrollmentId: string,
  status: AttendanceStatus,
  markOnline?: (
    enrollmentId: string,
    status: AttendanceStatus,
  ) => Promise<void>,
) {
  if (mode === 'online' && markOnline) {
    return markOnline(enrollmentId, status);
  }
  enqueue({
    type: 'attendance.mark',
    payload: { sessionId, enrollmentId, status },
  });
}
