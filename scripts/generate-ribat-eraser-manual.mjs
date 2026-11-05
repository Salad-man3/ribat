#!/usr/bin/env node
import { callTool } from './eraser-mcp-call.mjs';

const FILE_ID = '4na9vS2KphRJ4IRnOe71';

const diagrams = [
  {
    title: 'Ribat monorepo layout',
    diagramType: 'flowchart-diagram',
    code: `title Ribat monorepo layout
direction right

Root [icon: folder]
Apps [icon: box, color: blue] {
  API [icon: server, label: apps/api NestJS Prisma]
  Web [icon: monitor, label: apps/web React Vite PWA]
  Android [icon: smartphone, label: apps/android TWA]
  Demo [icon: play]
}
Packages [icon: package, color: green] {
  Shared [label: packages/shared Zod DTOs]
  QuranData [label: packages/quran-data]
}
Deploy [icon: docker, color: orange, label: deploy Dockerfile Caddy compose]
Turbo [icon: zap, label: pnpm workspaces + Turborepo]

Root > Apps
Root > Packages
Root > Deploy
Apps > Turbo
Packages > Turbo`,
  },
  {
    title: 'ERD Platform and tenancy',
    diagramType: 'entity-relationship-diagram',
    code: `title Ribat platform and tenancy

Organization [icon: building, color: blue] {
  id uuid pk
  name string
  status enum
  timezone string
}

Identity [icon: user, color: green] {
  id uuid pk
  email string
  passwordHash string
  status enum
}

Membership [icon: link] {
  id uuid pk
  organizationId uuid
  identityId uuid
  memberId uuid
  role enum
  status enum
}

AuthSession [icon: key] {
  id uuid pk
  identityId uuid
  tokenHash string
  expiresAt timestamp
}

AccountSetupCode [icon: mail] {
  id uuid pk
  identityId uuid
  codeHash string
}

JoinApplication [icon: file-text] {
  id uuid pk
  organizationId uuid
  kind enum
  status enum
}

Organization.id < Membership.organizationId
Identity.id < Membership.identityId
Identity.id < AuthSession.identityId
Identity.id < AccountSetupCode.identityId
Organization.id < JoinApplication.organizationId`,
  },
  {
    title: 'ERD People',
    diagramType: 'entity-relationship-diagram',
    code: `title Ribat people domain

Organization [icon: building] {
  id uuid pk
}

Member [icon: user, color: blue] {
  id uuid pk
  organizationId uuid
  householdId uuid
  displayName string
  status enum
}

Household [icon: home] {
  id uuid pk
  organizationId uuid
}

GuardianLink [icon: link] {
  id uuid pk
  guardianMemberId uuid
  wardMemberId uuid
  relation enum
}

MemberNote [icon: sticky-note] {
  id uuid pk
  memberId uuid
  visibility enum
}

Tag [icon: tag] {
  id uuid pk
  organizationId uuid
  name string
}

MemberTag [icon: hash] {
  memberId uuid pk
  tagId uuid pk
}

CustomFieldDefinition [icon: settings] {
  id uuid pk
  organizationId uuid
  entityType enum
}

Organization.id < Member.organizationId
Organization.id < Household.organizationId
Household.id < Member.householdId
Member.id < GuardianLink.guardianMemberId
Member.id < GuardianLink.wardMemberId
Member.id < MemberNote.memberId
Organization.id < Tag.organizationId
Member.id < MemberTag.memberId
Tag.id < MemberTag.tagId
Organization.id < CustomFieldDefinition.organizationId`,
  },
  {
    title: 'ERD Courses and scheduling',
    diagramType: 'entity-relationship-diagram',
    code: `title Ribat courses and scheduling

Program [icon: layers] {
  id uuid pk
  organizationId uuid
}

Course [icon: book-open, color: blue] {
  id uuid pk
  organizationId uuid
  programId uuid
}

Material [icon: file] {
  id uuid pk
  organizationId uuid
}

CourseMaterial [icon: link] {
  courseId uuid pk
  materialId uuid pk
}

Enrollment [icon: user-check] {
  id uuid pk
  courseId uuid
  memberId uuid
}

CourseSession [icon: calendar] {
  id uuid pk
  courseId uuid
  startsAt timestamp
}

Attendance [icon: check-square] {
  id uuid pk
  sessionId uuid
  enrollmentId uuid
  status enum
  markedAt timestamp
}

CourseSchedule [icon: clock] {
  id uuid pk
  courseId uuid
}

ExcuseRequest [icon: alert-circle] {
  id uuid pk
  sessionId uuid
  enrollmentId uuid
}

Program.id < Course.programId
Course.id < CourseMaterial.courseId
Material.id < CourseMaterial.materialId
Course.id < Enrollment.courseId
Course.id < CourseSession.courseId
CourseSession.id < Attendance.sessionId
Enrollment.id < Attendance.enrollmentId
Course.id < CourseSchedule.courseId
CourseSession.id < ExcuseRequest.sessionId`,
  },
  {
    title: 'ERD Progress and communication',
    diagramType: 'entity-relationship-diagram',
    code: `title Ribat progress and communication

Member [icon: user] {
  id uuid pk
}

MemorizationLog [icon: book, color: green] {
  id uuid pk
  memberId uuid
  materialId uuid
}

MemorizationTest [icon: award] {
  id uuid pk
  memberId uuid
}

MemorizationSummary [icon: bar-chart] {
  id uuid pk
  memberId uuid
  materialId uuid
}

Homework [icon: clipboard] {
  id uuid pk
  courseId uuid
}

HomeworkTask [icon: list] {
  id uuid pk
  homeworkId uuid
  enrollmentId uuid
}

Notification [icon: bell] {
  id uuid pk
  identityId uuid
}

ReportCard [icon: file-text] {
  id uuid pk
  memberId uuid
}

SyncMutation [icon: refresh-cw, color: orange] {
  id uuid pk
  organizationId uuid
  idempotencyKey string
}

StatsDaily [icon: trending-up] {
  id uuid pk
  organizationId uuid
  scopeType enum
}

Member.id < MemorizationLog.memberId
Member.id < MemorizationTest.memberId
Member.id < MemorizationSummary.memberId
Homework.id < HomeworkTask.homeworkId
Member.id < ReportCard.memberId`,
  },
  {
    title: 'API request pipeline',
    diagramType: 'sequence-diagram',
    code: `title Ribat API request pipeline
autoNumber on

Client [icon: monitor]
NestJS [icon: server, color: blue]
Prisma [icon: database]
Audit [icon: file-text]

Client > NestJS: HTTP /api/v1
activate NestJS
NestJS > NestJS: RequestIdMiddleware
NestJS > NestJS: CsrfGuard unsafe methods
NestJS > NestJS: SessionGuard cookie
NestJS > NestJS: OrgContextGuard membership
NestJS > Prisma: scoped query organizationId
Prisma --> NestJS: rows
NestJS > Audit: AuditInterceptor
NestJS --> Client: JSON envelope
deactivate NestJS`,
  },
  {
    title: 'Offline sync sequence',
    diagramType: 'sequence-diagram',
    code: `title Ribat offline sync
autoNumber on

TeacherPWA [icon: smartphone]
Dexie [icon: hard-drive, color: green]
API [icon: server, color: blue]
Postgres [icon: database]

TeacherPWA > API: GET class-kit online
API --> TeacherPWA: kit
TeacherPWA > Dexie: store kit 24h

TeacherPWA > Dexie: queue mutations idempotencyKey offline

TeacherPWA > API: POST sync/mutations batch
activate API
API > Postgres: per-mutation txn dedupe apply audit
Postgres --> API: ok
API --> TeacherPWA: applied duplicate superseded rejected
deactivate API
TeacherPWA > Dexie: clear queue show conflicts`,
  },
  {
    title: 'Login session and CSRF',
    diagramType: 'sequence-diagram',
    code: `title Ribat login session CSRF
autoNumber on

Browser [icon: monitor]
AuthAPI [icon: server, color: blue]
DB [icon: database]

Browser > AuthAPI: POST login credentials
AuthAPI > DB: verify argon2id Identity
DB --> AuthAPI: ok
AuthAPI --> Browser: Set-Cookie ribat_session httpOnly
AuthAPI --> Browser: Set-Cookie ribat_csrf HMAC

Browser > AuthAPI: POST mutation + x-csrf-token
AuthAPI > AuthAPI: CsrfGuard match cookies
AuthAPI --> Browser: 200

Browser > AuthAPI: POST logout
AuthAPI > DB: revoke AuthSession
AuthAPI --> Browser: clear cookies`,
  },
  {
    title: 'Domain event outbox',
    diagramType: 'sequence-diagram',
    code: `title Ribat domain event outbox
autoNumber on

Service [icon: server, color: blue]
Postgres [icon: database]
Dispatcher [icon: refresh-cw]
Redis [icon: database, color: red]
Worker [icon: cpu]

Service > Postgres: BEGIN business write + DomainEvent
Postgres --> Service: COMMIT
Dispatcher > Postgres: poll pending EventDelivery
Dispatcher > Redis: enqueue BullMQ job
Worker > Redis: consume job
Worker > Postgres: side effects notifications stats
Worker > Postgres: mark delivery complete`,
  },
];

async function main() {
  const results = [];
  for (const d of diagrams) {
    process.stderr.write(`Manual: ${d.title}\n`);
    try {
      const result = await callTool('manually_create_diagram', {
        fileId: FILE_ID,
        title: d.title,
        diagramType: d.diagramType,
        code: d.code,
      });
      const parsed = JSON.parse(result.content[0].text);
      results.push({
        title: d.title,
        diagramUrl: parsed.diagramUrl,
        diagramId: parsed.id,
        diagramType: parsed.diagramType,
      });
    } catch (e) {
      results.push({ title: d.title, error: e.message });
    }
  }
  console.log(
    JSON.stringify(
      {
        fileUrl: `https://app.eraser.io/workspace/${FILE_ID}`,
        diagrams: results,
      },
      null,
      2,
    ),
  );
}

main();
