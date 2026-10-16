#!/usr/bin/env bash
# Fresh demo data, a class running right now for both teachers, then every recording.
set -e
cd "$(dirname "$0")/.."
export PGPASSWORD=ribat DB=postgresql://ribat:ribat@127.0.0.1:5435/ribat_video
(cd ../apps/api && DATABASE_URL=$DB npx tsx prisma/seed.ts > /dev/null)
psql -h 127.0.0.1 -p 5435 -U ribat -d ribat_video -q <<'SQL'
insert into "CourseSession" (id, "organizationId", "courseId", date, "startsAt", "endsAt", status, "isException", topic)
select gen_random_uuid(), c."organizationId", c.id, (now() at time zone 'Asia/Damascus')::date,
       date_trunc('minute', now()) - interval '15 minutes', date_trunc('minute', now()) + interval '75 minutes', 'SCHEDULED', true, null
from "Course" c where c.name in ('حلقة تحفيظ العصر', 'دورة التجويد');
SQL
for r in ${@:-sheikh teacher teacher2 student father themes}; do node record/$r.mjs; done
