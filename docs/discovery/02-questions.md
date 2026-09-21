# Ribat — Discovery Questions

> **Stage:** Discovery (2026-09-17). Read [01-idea-analysis.md](./01-idea-analysis.md) first.

## How to answer

- Write your answer after **Answer:** under each question. Arabic is fine.
- Write **`default`** to accept my suggestion.
- Write **`skip`** to decide later.
- Each question has a tag:
  - **`[now]`** — I need this before I write the spec. Answer these first.
  - **`[build]`** — needed before that feature is built.
  - **`[later]`** — after the beta.

---

## 0. Unclear spots in your brief

### 0.1 `[now]` Duplicate "activities"

Your main tables list `activities` twice (`activities … actvities`). Is that a typo, or
did you mean another table (tests? attendance? materials?)?

**Answer:**

### 0.2 `[now]` Cut-off sentence

"…CRUD allowed for the teacher and sheikh and the …" — and who else? The org admin?

**Answer:**

### 0.3 `[now]` "Course activities" vs. "activities"

What is the difference? Give one real example of each.

**Answer:**

### 0.4 `[now]` "Leaderboard for common courses"

What does "common" mean?
- (a) All students inside one course
- (b) Students across different groups or teachers inside the same course
- (c) Several courses that share the same material
- (d) The whole mosque

**Answer:**

### 0.5 `[now]` Is "guardian" a fifth user type?

Your user list has four types (SaaS owner, org admin, sheikh, member), but later you mention
"the guardian user". Is a guardian its own user type, or a member who has linked children?

**Answer:**

---

## 1. Goals, beta and timeline

### 1.1 `[now]` Rank your goals

Rank these from most to least important:
- (a) Get a backend job
- (b) The mosque actually uses the app every week
- (c) A real SaaS business with paying mosques

*Why:* when goals conflict (polishing the UI for the mosque vs. writing tests for
recruiters), this ranking decides.

**Answer:**

### 1.2 `[now]` Dates and hours

- When must the public repo and live demo exist, so you can apply with them?
- When should the mosque start using the app?
- How many hours per day can you give this?

**Answer:**

### 1.3 `[now]` Mosque size

Rough numbers are fine:
- Students
- Teachers
- Courses or halaqat
- Sheikhs
- Admins
- Age range
- Groups: boys / girls / men / women?

**Answer:**

### 1.4 `[now]` What do they use today?

Paper, Excel, WhatsApp groups, another app? What frustrates the sheikh most? That
frustration is the beta's first feature.

**Answer:**

### 1.5 `[now]` What counts as beta success?

Which weekly workflow must run in the app for the beta to count?

*Default:* every halaqa takes attendance and logs memorization in the app for 4 weeks in a row.

**Answer:**

### 1.6 `[now]` Contact person and initial data

- Who is your contact at the mosque, and have they agreed to try the app?
- Will they give feedback every week?
- Who enters the initial data (the list of students)?
- Can you get that list as an Excel file? If yes, an import feature saves a lot of typing.

**Answer:**

### 1.7 `[later]` Business model

Any pricing idea? Free forever? Paid per mosque?

*Default:* no billing in the beta, but the data model stays multi-tenant.

**Answer:**

### 1.8 `[now]` Old spec: start fresh or restore?

The old spec (in trash) decided:
- NestJS modular monolith
- Prisma + PostgreSQL 16
- React/Vite PWA with a Dexie offline queue
- Tailwind + shadcn/ui
- Cookie sessions + CSRF
- Invite codes, then OTP later
- Server-wins sync with idempotency keys
- Cross-tenant requests return 404
- Append-only audit log and points ledger
- No Redis at first
- Hetzner VPS + Caddy + Docker Compose
- Links only (no file uploads)
- **Exams out of scope**

Your new brief already changes some of this: memorization tests are now in, and the roles
are different.

*Default:* start fresh with lean docs, and re-decide each point in section 20.

**Answer:**

### 1.9 `[now]` Name and public framing

- Keep the name "Ribat" (رباط)?
- Public README: "mosque education management", or a neutral "community school
  management"? The old docs chose neutral wording and renamed `sheikh` to `academic_lead`.
  Your brief now says mosque and sheikh.
- Code: use the role name `SHEIKH`, or a neutral name?

*Default:* the UI and README say mosque and sheikh (it's the real use case and the better
story). The code uses `Organization` for the tenant and `SHEIKH` as the role name.

**Answer:**

---

## 2. Users, roles and accounts

### 2.1 `[now]` SaaS owner access

Can the SaaS owner see mosque data (students, logs), or only organization-level info (name,
counts, status)? Is support access or impersonation needed?

*Default:* no access to mosque data; aggregate numbers only.

**Answer:**

### 2.2 `[now]` Sheikh vs. org admin

Is there anything the sheikh can do that the org admin cannot, or the reverse? Examples:
only the sheikh publishes report cards; only the admin manages accounts.

*Default:* the same permissions. The sheikh is the academic owner; the admin is a helper who
also manages accounts.

**Answer:**

### 2.3 `[now]` How many sheikhs and admins?

How many sheikhs and admins can one mosque have? Is the sheikh always exactly one person?

**Answer:**

### 2.4 `[now]` Admin ↔ member switch

The org admin "switches to his personal member account".
- Is that one login with a switch button, or two separate logins?
- Does the sheikh get the same switch (for example, if the sheikh studies in another course)?

*Default:* one login, one person. The switch changes the active view (admin view ↔ member view).

**Answer:**

### 2.5 `[now]` Teacher in one course, student in another?

Can a member teach course A and study in course B at the same time?

*Default:* yes. Teacher and student are per-course roles, not global ones.

**Answer:**

### 2.6 `[now]` Guardians

- Must a guardian be a member of the mosque?
- Can a guardian log in without being a student?
- Can a child have two guardian accounts (mother and father)?
- Can one guardian have several children?

*Default:* a guardian is a person with a login, linked to one or more children, and does not
have to study at the mosque.

**Answer:**

### 2.7 `[now]` Do children log in?

Do young students have their own login? From what age? Or only their guardians?

*Default:* under 12, no login (the guardian sees everything). From 12 up, their own login.

**Answer:**

### 2.8 `[build]` Siblings

Are siblings linked automatically (they share a guardian), or linked by hand?

*Default:* automatically, through a shared guardian.

**Answer:**

### 2.9 `[now]` Gender separation

- Are there separate sections for boys and girls, or men and women?
- Must male teachers be blocked from seeing female students' data (and the reverse)?
- Are there female teachers?

**Answer:**

### 2.10 `[later]` More than one mosque

Can one person belong to two mosques (for example, teaching in both)?

*Default:* the data model allows it; the switching UI comes later.

**Answer:**

### 2.11 `[build]` What a teacher can see

- Can a teacher see students who aren't in their course?
- Can they see other teachers' groups in the same course?

*Default:* only their own course. When groups are on, only their own group. The sheikh and
admin see everything.

**Answer:**

### 2.12 `[build]` Staff notes

Should there be private notes about a student, hidden from guardians? Who can see them?

**Answer:**

---

## 3. Login and security

### 3.1 `[now]` Login method

- (a) Phone number + password. The admin creates the account and hands out a one-time code
  to set the password.
- (b) Phone number + SMS code (costs money, and delivery to +963 numbers can be unreliable)
- (c) Username + password
- (d) Google login (many parents and children may not use it)

*Default:* (a).

**Answer:**

### 3.2 `[now]` Password reset

With no email or SMS, how does someone reset a forgotten password?

*Default:* the admin issues a new one-time code.

**Answer:**

### 3.3 `[now]` Self-signup

Can a parent sign up alone and request a link to their child, or does only the admin create
accounts?

*Default:* only the admin creates accounts in the beta.

**Answer:**

### 3.4 `[build]` SaaS owner login

Your old note says: "a login with a code that only I have, and nobody can get it from the
git repo."

*Default:* a seed command creates the owner account from an environment variable. The
secret is stored hashed and never committed. Two-factor login is added later.

**Answer:**

### 3.5 `[build]` Shared devices

Do teachers use their own phones, or a shared mosque tablet? This affects how long sessions
last and what data is stored on the device.

**Answer:**

### 3.6 `[build]` How long do logins last?

How long should someone stay logged in on their phone?

*Default:* 30 days (renewed while in use) for members; shorter for admins and the sheikh.

**Answer:**

---

## 4. Courses and structure

### 4.1 `[now]` Levels above courses?

Your old Arabic notes had levels (المستويات), and the old spec had containers. Do you need a
level or group layer above courses, or is a flat list of courses enough?

*Default:* a flat list of courses with an optional category in the beta.

**Answer:**

### 4.2 `[now]` Course fields

Proposed: name, type, description, start and end dates, weekly days and times, location,
gender, age range, capacity, status. Add or remove anything?

**Answer:**

### 4.3 `[now]` Course types

- Only memorization and explanation?
- Can one course be both (e.g., memorize Tuhfat al-Atfal *and* explain it)?
- Any future types (a lecture series with no enrolled students, an exam-based course)?

*Default:* exactly one type per course, with room to add more types later.

**Answer:**

### 4.4 `[now]` Enrollment

- Who adds students to a course?
- Can members or guardians request to join?
- Is there a capacity limit or waitlist?

*Default:* the sheikh or admin adds students directly. No requests or waitlist in the beta.

**Answer:**

### 4.5 `[build]` Course lifecycle

Draft → active → finished → archived? What happens when a course finishes: it becomes
read-only? A final report card? A certificate?

**Answer:**

### 4.6 `[build]` Class sessions

Do you need each class meeting stored as a record (date, time, cancelled, topic), or just
"attendance on date X"?

*Default:* sessions are generated from the weekly schedule, and the teacher can add or
cancel one.

**Answer:**

### 4.7 `[build]` Schedule times

Are class times fixed clock times, or tied to prayers ("after Asr", "between Maghrib and
Isha") so they shift through the year? Is there a separate Ramadan schedule? Your
`masjid-prayer-widget` project already has prayer-time and Hijri logic.

**Answer:**

### 4.8 `[build]` Calendar

Show Gregorian dates, Hijri dates, or both?

**Answer:**

### 4.9 `[build]` Holidays and breaks

Can a course be paused (Eid, school exam season) so that no absences are recorded?

**Answer:**

---

## 5. Teachers and hierarchical courses

### 5.1 `[now]` Normal (non-hierarchical) course

Who teaches it: exactly one teacher? Can the sheikh teach it with no teacher assigned?

*Default:* one lead, who is either the sheikh or a member.

**Answer:**

### 5.2 `[now]` Toggle 1 on, toggle 2 off

Several teachers but no groups. Can every teacher log for every student in the course?

*Default:* yes.

**Answer:**

### 5.3 `[now]` Toggle 2 on (groups)

- Does each teacher see and log only their own students?
- Can the sheikh and admin log for any student?

*Default:* yes to both.

**Answer:**

### 5.4 `[now]` Two teachers for one student?

Can one student have two teachers in the same course (e.g., one for new memorization, one
for revision)?

*Default:* no, one teacher per student per course.

**Answer:**

### 5.5 `[build]` Moving a student between teachers

If a student moves to another teacher mid-course, do the old logs stay credited to the
teacher who wrote them?

*Default:* yes. Every log keeps its author, and the assignment history is kept.

**Answer:**

### 5.6 `[build]` Turning a toggle off after data exists

Block it, or hide the existing data?

*Default:* block while assignments exist; unassign first.

**Answer:**

### 5.7 `[now]` How deep is the hierarchy?

Only course → teachers → students? Or can a teacher have assistants below them?

*Default:* two levels maximum.

**Answer:**

### 5.8 `[build]` Assigning a teacher by name

When you type a name to assign a teacher, must that person already be a member with a login?
Can you assign someone who has no account yet?

*Default:* they must be a member; their login can be created later.

**Answer:**

### 5.9 `[build]` Who manages a group's students?

Can teachers add or remove students in their own group, or only the sheikh and admin?

*Default:* only the sheikh and admin.

**Answer:**

### 5.10 `[build]` Teacher accountability

Should the sheikh see which teachers didn't log anything today?

*Default:* yes, in statistics.

**Answer:**

### 5.11 `[later]` Teacher attendance

Should teachers' own attendance be tracked?

**Answer:**

---

## 6. Memorization courses

### 6.1 `[now]` What is memorized?

Only the Quran? Also texts (mutoon) like Tuhfat al-Atfal or al-Jazariyya? Hadith collections
like the 40 Nawawi?

*Why:* the Quran's structure (114 surahs, 30 juz, 604 pages) can be built into the app.
Other texts need a generic "units" model.

*Default:* the Quran built in, plus a generic model for other texts.

**Answer:**

### 6.2 `[now]` Unit of progress

- What does the teacher log: an ayah range (surah:ayah → surah:ayah), pages, lines, surahs,
  or juz?
- Which mushaf: the standard 604-page Madinah mushaf?

*Default:* the teacher picks an ayah range, and the app calculates pages.

**Answer:**

### 6.3 `[now]` Log types per sitting

New memorization (حفظ جديد), near revision (مراجعة قريبة), far revision (مراجعة بعيدة)?
Anything else, such as consolidation (تثبيت)?

**Answer:**

### 6.4 `[now]` Recitation quality

What is recorded per recitation?

*Default:* a grade (excellent / very good / good / repeat), a mistake count, and an optional
note.

**Answer:**

### 6.5 `[now]` Tests

- When are tests taken: after each juz? Every 5 juz? Each surah?
- Who tests: the same teacher, the sheikh, or a separate examiner?
- Result format: pass/fail, a score out of 100, or mistake counts?
- Are retakes recorded?

*Default:* one test per juz, scored out of 100, with a pass mark set per course. All
attempts are kept.

**Answer:**

### 6.6 `[build]` Memorization order

Some students start from An-Nas and go backwards; others start from Al-Fatiha. Must progress
percentages work in either direction?

*Default:* track the set of memorized ranges, regardless of order.

**Answer:**

### 6.7 `[now]` Lifetime record or per course?

Is a student's memorized amount a lifetime record that carries across courses and years, or
does it reset with each course?

*Why:* this is one of the biggest data-model decisions.

*Default:* a lifetime record. Each log is also tagged with the course it happened in.

**Answer:**

### 6.8 `[build]` Plans and targets

Should each student have a target (e.g., 1 page per day, finish juz 30 by June) with an
on-track / behind indicator?

*Default:* later.

**Answer:**

### 6.9 `[build]` Starting point

Can a student's previous memorization (from before joining) be entered as their starting
level?

*Default:* yes.

**Answer:**

---

## 7. Explanation courses and materials

### 7.1 `[now]` Progress per class or per student?

Is the page number logged once per class (the whole class moves together), or separately for
each student?

*Default:* once per class (or per group). Attendance records who was present.

**Answer:**

### 7.2 `[now]` Material fields

Title, author, total pages, type (book / PDF / link / audio)? Should chapters or lessons be
the unit instead of pages?

**Answer:**

### 7.3 `[build]` File uploads

Upload PDFs (costs storage and needs moderation), or links only?

*Default:* links only in the beta.

**Answer:**

### 7.4 `[build]` Log entry

Page from → to for each material, with several materials allowed in one session, plus a
topic or notes field?

*Default:* yes.

**Answer:**

### 7.5 `[build]` Who edits materials in hierarchical courses?

Every teacher, or only the sheikh and admin? (See 0.2.)

**Answer:**

### 7.6 `[build]` Tests in explanation courses

Do explanation courses have tests or grades too?

*Default:* a simple optional quiz score, later.

**Answer:**

### 7.7 `[later]` Missed content

Should absent students see what they missed (e.g., "you missed pages 40–45")?

**Answer:**

---

## 8. Attendance

### 8.1 `[now]` Statuses

Present, absent, late, excused? Anything more (left early)?

**Answer:**

### 8.2 `[now]` Editing attendance

From your brief, the course teacher, the sheikh or the admin marks attendance. Who can edit
it afterwards, and for how long?

*Default:* the person who marked it can edit the same day; the sheikh and admin can edit any
time; every edit is logged.

**Answer:**

### 8.3 `[build]` Excuses

Can guardians submit an excuse in the app ahead of time?

**Answer:**

### 8.4 `[build]` Absence notifications

Tell the guardian immediately, at the end of the day, or only in reports?

*Default:* an end-of-day summary per child.

**Answer:**

### 8.5 `[build]` Automatic warnings

Should a warning be issued automatically after N absences? What is N, and is it counted per
course or per month?

**Answer:**

### 8.6 `[build]` Unmarked sessions

If nobody marks a session, should everyone be marked absent automatically, or should it stay
"not taken"?

*Default:* stays "not taken", and the sheikh gets an alert.

**Answer:**

### 8.7 `[later]` Activity attendance

Is attendance recorded for activities too?

**Answer:**

---

## 9. Offline

### 9.1 `[now]` Internet at the mosque

Is there Wi-Fi or mobile data? How long are people typically offline: a few minutes, the
whole class, or days?

**Answer:**

### 9.2 `[now]` Devices

Mostly Android or iPhone? Old phones? Personal or shared?

**Answer:**

### 9.3 `[now]` What works offline

Offline writes: attendance and progress logs. To make those possible, these must also be
readable offline: my courses, today's sessions, student lists, and each student's last
position. Is anything else needed (student cards, materials)?

*Default:* exactly that set (a "class kit").

**Answer:**

### 9.4 `[build]` Offline conflicts

What if a teacher and the sheikh mark the same student differently while both are offline?

*Default:* the latest change wins, both versions stay in the history, and the person who was
overridden gets a notice. Progress logs are only ever added, never edited, so they don't
conflict; duplicates are caught by an idempotency key.

**Answer:**

### 9.5 `[build]` Opening the app offline

If a teacher was already logged in, can they open the app while offline?

*Default:* yes, if the session was active before going offline. A fresh login needs internet.

**Answer:**

### 9.6 `[build]` Showing unsynced changes

*Default:* a badge counting unsynced changes, plus a "last synced" time.

**Answer:**

---

## 10. Homework

### 10.1 `[now]` What is homework here?

"Memorize X for next time", "read these pages", written questions? Submitted in the app, or
does the teacher just mark done / not done?

*Default:* the teacher assigns a task with a due date and marks it done or not done. No
uploads.

**Answer:**

### 10.2 `[build]` Who gets it?

Is homework given to the whole course, one group, or one student?

**Answer:**

### 10.3 `[build]` Rewards and consequences

Points for completing homework? A warning after N missed?

**Answer:**

### 10.4 `[build]` Guardians and homework

Do guardians see homework and get reminders?

**Answer:**

---

## 11. Points and leaderboard

### 11.1 `[now]` Automatic points

Which events give points, and how many?
- Attendance, arriving on time
- New memorization (per page or per ayah)
- Passing a test
- Homework done
- Activity participation
- Negative points for absence, lateness or warnings?

Who sets the values: org-wide by the sheikh, or per course?

*Default:* org-wide rules set by the sheikh or admin, which a course can override.

**Answer:**

### 11.2 `[build]` Manual points

- Who can give them: teacher, sheikh, admin?
- Are negative points allowed?
- Is a reason required?
- A daily limit per teacher?

*Default:* all three roles can give points, a reason is required, negatives are allowed, no
limit, and every entry is logged.

**Answer:**

### 11.3 `[now]` Per course or overall?

Are points counted per course, as one total per student across the mosque, or both?

*Default:* both. Each entry is tagged with its course, and totals are calculated.

**Answer:**

### 11.4 `[build]` Spending points

Can students spend points on prizes (a rewards store), or are points for ranking only?

*Default:* ranking only in the beta.

**Answer:**

### 11.5 `[now]` Leaderboard scope and periods

- Scope (see 0.4): within a course, across groups in a hierarchical course, or across the
  whole mosque?
- Periods: weekly, monthly, by season, all-time?
- When does it reset?

**Answer:**

### 11.6 `[build]` Leaderboard privacy

- Who sees it: students, guardians, a public screen at the mosque?
- Show children's full names to other families, or first name + family initial?
- Can a family opt out?

*Default:* first name + family initial, visible to the course's students and their
guardians, with an opt-out.

**Answer:**

### 11.7 `[later]` Group competitions

Should halaqat or teams compete on a group leaderboard?

**Answer:**

---

## 12. Warnings

### 12.1 `[now]` Types and levels

- Types: behavior, absence, homework, academic?
- Levels: first, second, final?
- What happens at the final warning (suspension from the course)?

**Answer:**

### 12.2 `[build]` Automatic or manual

Are warnings issued automatically, manually, or both?

*Default:* manual, plus automatic for absences (see 8.5).

**Answer:**

### 12.3 `[build]` Who issues them

Does a teacher issue a warning directly, or propose it for the sheikh to approve?

*Default:* the teacher proposes, and the sheikh or admin sends it to the family.

**Answer:**

### 12.4 `[build]` After a warning is sent

- Must the guardian acknowledge it (read receipt)?
- Do warnings expire?
- Do they deduct points?

**Answer:**

---

## 13. Activities

### 13.1 `[now]` Examples

(See 0.3.) What are examples of course activities vs. mosque activities (trip, camp, iftar,
competition, sports)?

**Answer:**

### 13.2 `[build]` Who joins

Invited list, open registration, or everyone in a course automatically? Do children need
guardian approval?

**Answer:**

### 13.3 `[build]` Fees

Track fees and cash payments by hand?

*Default:* not in the beta.

**Answer:**

### 13.4 `[build]` Activity details

Do activities have attendance, points or a capacity limit?

**Answer:**

---

## 14. Student info card and progress

### 14.1 `[now]` Card fields

Candidates:
- Full name (first / father / family), mother's name
- Birth date, phone, address
- School grade, school name
- National ID, photo
- Medical or allergy notes
- Join date, notes

Which are required? Which are sensitive and visible to admins only?

*Default:* no national ID and no photo in the beta.

**Answer:**

### 14.2 `[build]` Who sees which fields

What can each of these see: the teacher (own students), the sheikh and admin, the guardian,
the student?

**Answer:**

### 14.3 `[now]` Contact-only parents

Can a parent be stored as contact info only (name and phone, no account), and upgraded to
an account later?

*Default:* yes.

**Answer:**

### 14.4 `[build]` Progress on the card

- Memorization: total memorized, last position, tests
- Explanation: pages covered, attendance percentage
- Also: points, warnings, homework completion rate

Add or remove anything?

**Answer:**

### 14.5 `[build]` WhatsApp button

Keep the WhatsApp button to the parent from your old notes?

*Default:* yes, a simple `wa.me` link (no WhatsApp API).

**Answer:**

### 14.6 `[later]` Students who leave

Keep their history, archive it, or delete it after X years?

**Answer:**

---

## 15. Notifications and report cards

### 15.1 `[now]` Channels

- In-app inbox
- Web push (works on Android; on iPhone only after the app is added to the Home Screen)
- SMS (paid)
- WhatsApp Business API (paid, needs approval)
- Email

*Default:* in-app plus web push, and a WhatsApp share link for report cards.

**Answer:**

### 15.2 `[now]` Who gets notified about what

Fill in or edit. Recipients: **S** = student, **G** = guardian, **T** = teacher,
**A** = sheikh/admin.

| Event | Who is notified |
| --- | --- |
| Absence | |
| Late | |
| Warning | |
| Test result | |
| Report card published | |
| Homework assigned | |
| Homework missed | |
| Schedule change or cancellation | |
| Activity invitation | |
| Points milestone | |
| Announcement | |

**Answer:**

### 15.3 `[now]` Report cards

- How often: weekly, monthly, per term?
- What goes in them?
- Generated automatically, or does the teacher add a comment and the sheikh approve before
  sending?
- A PDF, or an in-app page?

*Default:* monthly, drafted automatically, the teacher adds a comment, the sheikh publishes.
Shown as an in-app page that can be printed.

**Answer:**

### 15.4 `[build]` Announcements

Can the sheikh send announcements to a group (all guardians, one course)?

**Answer:**

### 15.5 `[build]` Avoiding spam

Quiet hours, or one daily digest instead of a message per event?

**Answer:**

---

## 16. Schedule

### 16.1 `[build]` What members and guardians see

A weekly timetable of their courses and activities? A "next session" card? Cancellations?

**Answer:**

### 16.2 `[build]` Teachers' schedule

If a teacher is also a student, do they see their teaching and study schedules combined?

**Answer:**

---

## 17. Statistics

### 17.1 `[now]` The sheikh's top numbers

What are the 5 numbers the sheikh wants to see every week? Suggestions:
- Attendance rate per course and per teacher
- Pages memorized this week
- Tests passed
- Top students
- Students at risk (attendance dropping, or no progress in 2 weeks)
- Teachers who haven't logged

**Answer:**

### 17.2 `[build]` Other stats views

Do teachers see statistics for their own groups? Do guardians see their child's trends as
charts?

**Answer:**

### 17.3 `[build]` SaaS owner statistics

Number of mosques, active users, logs per day. Anything else?

**Answer:**

### 17.4 `[build]` Export

Export statistics to Excel or PDF?

**Answer:**

### 17.5 `[later]` Freshness

Must statistics be live, or is hourly or nightly fine?

*Default:* hourly or nightly. It's simpler, and pre-computing aggregates is a good interview
talking point.

**Answer:**

---

## 18. Language, UI and devices

### 18.1 `[now]` Languages

Arabic only, or Arabic and English?

*Why:* recruiters abroad need English to try the demo.

*Default:* Arabic (RTL) and English, with translation support built in from day one.

**Answer:**

### 18.2 `[build]` Main device per role

Teachers on phones. The sheikh and admin on phones or laptops?

**Answer:**

### 18.3 `[build]` Look and feel

Are you happy with a ready-made component library (e.g., shadcn/ui) and a simple, clean
look? Any brand colors or logo?

**Answer:**

### 18.4 `[build]` Class mode screen

One screen for the teacher during class: the student list, tap to mark attendance, and quick
progress logging.

*Default:* yes. This screen decides whether teachers adopt the app.

**Answer:**

### 18.5 `[later]` Big-screen leaderboard

A leaderboard display for a TV in the mosque hall?

**Answer:**

---

## 19. Data, privacy and open source

### 19.1 `[now]` Real data vs. demo data

Real student data lives only on the private production instance. The public demo uses fake
data in a separate database. OK?

*Default:* yes.

**Answer:**

### 19.2 `[now]` Consent

Have the mosque and guardians agreed to storing children's data online? Should registration
include a simple consent note?

**Answer:**

### 19.3 `[build]` Retention and deletion

When a student leaves, is their data kept (archived) or deleted after some time? Can
guardians request deletion?

**Answer:**

### 19.4 `[build]` What gets audited

*Default:* every edit or delete of attendance, progress, points and warnings; role changes;
exports; logins.

**Answer:**

### 19.5 `[now]` Repo visibility and license

Public from day one? Which license?
- **MIT:** anyone can reuse it, even commercially
- **AGPL:** anyone who reuses it must keep their version open
- **No license:** the code is visible, but nobody may legally reuse it

*Why:* this only matters if the SaaS business is a goal (1.1).

**Answer:**

### 19.6 `[build]` Backups

*Default:* a daily encrypted database dump stored off-site, with a tested restore.

**Answer:**

---

## 20. Tech stack and engineering

> **Market context** from your scanner (335 Node/Nest postings): TypeScript 65%, AWS 50%,
> CI/CD 42%, React 41%, PostgreSQL 41%, observability 40%, Docker 32%, testing 25%,
> Redis 19%, queues 16%. Each ORM appears in only about 2%.
> Details are in [01-idea-analysis.md §3](./01-idea-analysis.md#3-how-recruiters-and-hiring-engineers-actually-look-at-it).

### 20.1 `[now]` Backend

NestJS + TypeScript + PostgreSQL?

*Default:* yes.

**Answer:**

### 20.2 `[now]` ORM

- **Prisma:** the old decision
- **TypeORM:** you took a course on it
- **Sequelize:** you used it at Ghaya
- **Drizzle**

Job posts rarely name the ORM, so choose for speed or for what you want to learn.

*Default:* Prisma. It shows a second ORM next to Ghaya's Sequelize.

**Answer:**

### 20.3 `[now]` Enforcing tenant isolation

- (a) An `organizationId` on every table, queries scoped in code, and tests that prove it
- (b) (a) plus PostgreSQL Row-Level Security as a second lock
- (c) A separate schema or database per mosque

*Default:* (a) for the beta, with (b) added after the beta as hardening (a strong interview
story), recorded as an ADR.

**Answer:**

### 20.4 `[now]` Redis and a job queue

Redis + BullMQ for notification jobs, scheduled report cards, retries, and possibly caching
the leaderboard. The old plan said no Redis. Redis and queues show up in 16–19% of postings,
and you already used Redis at Ghaya.

*Default:* yes, starting with the notifications slice.

**Answer:**

### 20.5 `[now]` Authentication implementation

Build your own (argon2 password hashes plus httpOnly cookie sessions, or JWT access and
refresh tokens), or use a provider (Clerk, Auth0, Supabase)? Providers may need foreign
payment methods or restrict some countries.

*Default:* your own, with cookie sessions. That fits a same-origin PWA, avoids third-party
dependencies, and makes a strong interview topic.

**Answer:**

### 20.6 `[now]` Frontend

React + Vite PWA (the old plan), Next.js, or something else?

*Default:* React + Vite + TanStack Query + Dexie (IndexedDB).

**Answer:**

### 20.7 `[now]` Who writes what

Which modules will you write by hand, so you can explain them line by line in interviews?

*Suggestion:* you write auth and permissions, tenant scoping, the attendance sync endpoint,
and the points ledger. I scaffold, build most of the frontend, write supporting tests, and
review your PRs.

**Answer:**

### 20.8 `[now]` Validation

- class-validator DTOs (the Nest standard)
- Zod schemas shared by the API and the PWA (you used Zod at Ghaya)

*Default:* Zod in a shared package, so offline-queued data is checked with the same rules on
both sides.

**Answer:**

### 20.9 `[now]` Hosting and budget

What can you pay for from Syria, and what's your monthly budget? Do you have a domain name?
- A VPS (Hetzner, DigitalOcean) with Docker Compose
- A platform (Render, Railway, Fly.io)
- AWS (in 50% of postings, so it's a CV keyword)

*Default:* whatever you can reliably pay for. If AWS works for you, prefer it for the CV.

**Answer:**

### 20.10 `[build]` Environments

*Default:* production (the real mosque) + a public demo (fake data) + local. No staging for
now.

**Answer:**

### 20.11 `[now]` Observability

Pino JSON logs, a request ID on every request, Sentry (free tier), an uptime check, and
health endpoints?

*Default:* yes. This closes your P0 gap.

**Answer:**

### 20.12 `[build]` Testing bar

*Default:* unit tests for domain rules, plus e2e tests against real Postgres in CI covering
permissions and tenant isolation for every endpoint. No coverage-percentage target.

**Answer:**

### 20.13 `[build]` API style

*Default:* REST with OpenAPI, and Swagger UI public on the demo.

**Answer:**

### 20.14 `[build]` Rate limiting

*Default:* `@nestjs/throttler` on login and sync endpoints.

**Answer:**

### 20.15 `[now]` Repo layout

*Default:* a pnpm workspaces monorepo (`apps/api`, `apps/web`, `packages/shared`) with
Turborepo, the same setup as Ghaya.

**Answer:**

### 20.16 `[now]` Git workflow

*Default:* a public GitHub repo. Rename `master` to `main` and protect it. Feature branches →
PR with CI → squash merge. Conventional commit messages.

**Answer:**

### 20.17 `[now]` AI tooling files

Keep the `.cursor/rules`, replace them with `CLAUDE.md`, or keep both in sync?

*Default:* `CLAUDE.md` as the main file; regenerate or remove the outdated Cursor rules.

**Answer:**

### 20.18 `[later]` Real-time updates

Live updates on the sheikh's dashboard (WebSockets)?

*Default:* not in the beta.

**Answer:**

---

## 21. Beta scope — sort the features

I pre-filled a suggestion. Move items between columns by editing the table.

| Feature | Beta | After beta | Later | Never |
| --- | :-: | :-: | :-: | :-: |
| Login, admin-created accounts | ✔ | | | |
| Mosque setup, roles, admin ↔ member switch | ✔ | | | |
| Members, guardians, siblings | ✔ | | | |
| Import students from Excel | ✔ | | | |
| Student info card (basic) | ✔ | | | |
| Courses: memorization and explanation types | ✔ | | | |
| Teacher assignment and hierarchical groups | ✔ | | | |
| Materials CRUD | ✔ | | | |
| Memorization log and tests | ✔ | | | |
| Explanation page log | ✔ | | | |
| Attendance | ✔ | | | |
| Offline attendance and progress logging | ✔ | | | |
| Schedule view for members and guardians | ✔ | | | |
| In-app notifications | ✔ | | | |
| Web push notifications | | ✔ | | |
| Report cards | | ✔ | | |
| Warnings | | ✔ | | |
| Homework | | ✔ | | |
| Points (automatic and manual) | | ✔ | | |
| Leaderboard | | ✔ | | |
| Statistics dashboard | | ✔ | | |
| Activities | | | ✔ | |
| SaaS owner console (a script in the beta) | | | ✔ | |
| Mosque self-signup | | | ✔ | |
| SMS / WhatsApp automation | | | ✔ | |
| Billing | | | ✔ | |

**Answer / notes:**

---

## What happens after you answer

1. I write the lean spec in `docs/`: beta scope, domain model and ERD, permission matrix, key
   flows, ADRs.
2. I set up the environment: `CLAUDE.md`, the monorepo scaffold, Docker Postgres, lint and
   tests, CI, an honest README.
3. We build slice S1, starting from the order in
   [01-idea-analysis.md §7](./01-idea-analysis.md#7-recommended-way-forward).
