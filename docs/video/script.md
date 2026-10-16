# Ribat — 5-minute pitch and walkthrough

English voiceover, Arabic subtitles (masculine forms throughout) burned in. Target length about 5:00.

- **Voice:** edge-tts `en-US-AndrewMultilingualNeural`, rate `-6%`. One clip per numbered line, so
  each clip's length sets the cut and the pauses live in the edit, not in the audio.
- **Arabic words in the English voiceover** are written in Arabic script, so the multilingual voice
  says them with their own sounds (خ in شيخ, ق in حلقة). Spelled in English it says "Ribbit",
  "Sheik" and "Halakka". «رِباطْ» and «شَيْخْ» carry full tashkeel with a final sukun, or the voice adds
  -un case endings; «حلقة» stays plain. Checked with Whisper on test clips.
- **The pitch is not Quran-only:** Ribat runs every kind of teaching in the mosque, memorization and
  lessons alike. Never present the number of circles as a feature; a mosque has as many as it makes.
- **Data:** `pnpm db:seed` (مسجد النور, 100 members). Logins: sheikh `+963999001001`, teacher
  `+963999001030`, student يوسف `+963999001040`, his father سالم `+963999001050`; password
  `demo-ribat-2026`.
- **Pace:** nothing moves faster than a person reading. Every action holds for at least 1.5 s
  after it lands; the camera zooms to the element being talked about, then eases back out.
  Desktop scenes at 1440×810, phone scenes at 390×844 inside a phone frame.
- **Sound:** no strings and no wind instruments. A cappella humming as the bed, a light daf
  only under the tech section, real silence for the offline moment, and soft UI clicks.

---

## 0 · Cold open — the problem (0:00–0:20)

**Screen:** A gold shamsa draws itself slowly on the emerald field.

| # | Voiceover | Subtitle |
|---|---|---|
| 0.1 | Every mosque is a school: Quran memorization, lessons in fiqh, Arabic, the seerah, and more. | كلُّ مسجدٍ مدرسة: تحفيظُ القرآن، ودروسٌ في الفقه والعربية والسيرة، وغيرُها. |
| 0.2 | But the notebooks get lost, absences are forgotten, and parents rarely know how far their children have come. | لكنّ الدفاترَ تضيع، والغيابَ يُنسى، والأهلُ لا يعرفون أين وصل أبناؤهم. |
| 0.3 | And the internet in the courtyard… is weak. | والإنترنتُ في صحنِ المسجد… ضعيف. |

## 1 · Ribat (0:20–0:35)

**Screen:** «رباط» resolves in Reem Kufi over the turning shamsa.

| # | Voiceover | Subtitle |
|---|---|---|
| 1.1 | This is رِباطْ: one system for all the teaching in a mosque, every حلقة and every lesson. | هذا رباط: نظامٌ واحدٌ لكلِّ ما يُعلَّم في المسجد، كلِّ حلقةٍ وكلِّ درس. |
| 1.2 | For the شَيْخْ, the teacher, the student and his family. Each sees exactly what is his. | للشيخ، وللمعلّم، وللطالب وأهله… كلٌّ يرى ما يخصّه. |

## 2 · The sheikh (0:35–1:45)

**Screen:** Desktop, theme زمرد with the pattern on. Sign in as the sheikh.

| # | Screen | Voiceover | Subtitle |
|---|---|---|---|
| 2.1 | Overview page settles in; slow push toward the menu. | Let's start at the desk of the شَيْخْ. | لنبدأ من مكتب الشيخ. |
| 2.2 | الأعضاء: slow scroll through Arabic names, then open a child. | Every member of the mosque, in one place: students, teachers and fathers, with their families. | كلُّ أعضاء المسجد في مكانٍ واحد: الطلاب والمعلّمون والآباء، مع عائلاتهم. |
| 2.3 | Issue a setup code; the code appears. | No email needed. The mosque hands out a one-time code, and each person sets his own password. | لا حاجة إلى بريدٍ إلكتروني. يعطي المسجدُ رمزاً لمرّةٍ واحدة، ويختار كلُّ شخصٍ كلمةَ مروره بنفسه. |
| 2.4 | Type a private note marked for the sheikh only. | The شَيْخْ keeps private notes that nobody else can see. | وللشيخ ملاحظاتٌ خاصّة لا يراها غيرُه. |
| 2.5 | الحلقات: open «+ حلقة جديدة», type a name, pick «تحفيظ وشرح», a place, create. | Opening a new حلقة takes a minute: a name, what it teaches, memorization, explanation or both, and where it meets. | فتحُ حلقةٍ جديدة يستغرق دقيقة: اسمُها، وما تُعلّمه، تحفيظاً أو شرحاً أو كليهما، ومكانُها. |
| 2.6 | On the new حلقة: switch on «عدة معلمين», then «مجموعات»; the groups card appears. | A حلقة can stay simple, one teacher for everyone. Or it can grow: a lead teacher with assistants, and the students split into groups, each teacher with his own. | تبقى الحلقةُ بسيطة، معلّمٌ واحدٌ للجميع. أو تكبر: معلّمٌ رئيسيٌّ ومساعدون، والطلابُ موزَّعون في مجموعات، لكلِّ معلّمٍ مجموعتُه. |
| 2.7 | حلقة تحفيظ العصر: zoom on the schedule rows, then the next four weeks. | Each class starts and ends at a set time, or at a prayer, from العصر to المغرب, and moves with the prayer as the seasons turn. | تبدأ كلُّ حلقةٍ وتنتهي بوقتٍ ثابت، أو عند صلاة، من العصر إلى المغرب، وتتحرّك مع الصلاة بتغيُّر الفصول. |
| 2.8 | إعدادات المسجد: nudge Isha by two minutes. | And the mosque sets every prayer to its own adhan, to the minute. | ويضبط المسجدُ كلَّ صلاةٍ على أذانه هو، دقيقةً بدقيقة. |
| 2.9 | سجل التغييرات: open one entry. | Every change is on record: who made it, and when. | وكلُّ تغييرٍ مسجَّل: مَن فعله، ومتى. |

## 3 · The teacher — class mode (1:30–2:40)

**Screen:** Phone frame, theme النبوي. Sign in as the teacher.

| # | Screen | Voiceover | Subtitle |
|---|---|---|---|
| 3.1 | Today, with the «الآن» badge. | Now, to the حلقة. The teacher opens his phone and sees today's classes, and the one happening right now. | والآن إلى الحلقة. يفتح المعلّمُ هاتفه، فيرى حلقاتِ اليوم، والحلقةَ القائمةَ الآن. |
| 3.2 | Tap a status for five students, one at a time. | Attendance is one tap per student: present, absent, late, or excused. | التحضيرُ بلمسةٍ واحدةٍ لكلّ طالب: حاضر، غائب، متأخّر، أو معذور. |
| 3.3 | Zoom on the tally bar. | The tally at the bottom shows who is left. | والعدّادُ في الأسفل يُظهر مَن بقي. |
| 3.4 | Open «تسجيل»: zoom on «حفظ جديد / مراجعة / اختبار», set the end ayah, grade, one mistake. | Then the recitation: new memorization, revision, or a test. Which surah, from which ayah to which. رِباطْ checks the range and works out the mushaf pages on its own. | ثم التسميع: حفظٌ جديد، أو مراجعة، أو اختبار. أيُّ سورة، ومن أيِّ آيةٍ إلى أيِّ آية. يتحقّق رباط من المدى، ويحسب صفحاتِ المصحف تلقائياً. |
| 3.5 | Zoom on «آخر موضع». | Every student picks up exactly where he stopped last time. | ويبدأ كلُّ طالبٍ من حيث توقّف آخرَ مرّة. |
| 3.6 | Airplane mode. **Silence.** | And if the internet drops? | وإن انقطع الإنترنت؟ |
| 3.7 | Keep marking; the sync card counts the queue. | Nothing stops. | لا شيء يتوقّف. |
| 3.8 | Back online; «أُرسلت كل التغييرات». | Every tap waits safely on the phone, then goes through when the connection returns. Once, never twice. | كلُّ لمسةٍ تُحفَظ على الهاتف، ثمّ تُرسَل حين يعود الاتصال… مرّةً واحدة، لا مرّتين. |
| 3.9 | دورة التجويد: log the pages explained. | In explanation lessons, the teacher logs the pages he covered, and sets homework for the class or for one student. | وفي دروس الشرح، يسجّل المعلّمُ الصفحاتِ التي شرحها، ويُسند الواجباتِ للحلقة أو لطالبٍ بعينه. |

## 4 · The student (2:40–3:05)

**Screen:** Phone frame, theme مصحف. Sign in as يوسف.

| # | Screen | Voiceover | Subtitle |
|---|---|---|---|
| 4.1 | بوابتي: slow scroll through the week. | Yusuf, a student, sees his week in both Hijri and Gregorian dates… | والطالبُ يوسف يرى أسبوعه بالتاريخين الهجريّ والميلاديّ… |
| 4.2 | Zoom on attendance, memorization, tests. | …his attendance, the last place he reached in the Quran, his test results and his homework. | …وحضورَه، وآخرَ موضعٍ وصل إليه في المصحف، ونتائجَ اختباراته، وواجباته. |
| 4.3 | Hold on his progress. | He knows where he is, and where he is heading. | يعرف أين هو… وإلى أين يمضي. |

## 5 · The father (3:05–3:45)

**Screen:** Phone frame, theme إزنيق. Sign in as سالم, Yusuf's father.

| # | Screen | Voiceover | Subtitle |
|---|---|---|---|
| 5.1 | أبناؤك; the notifications badge shows 3. | His father doesn't wait for the end of term to find out. | أمّا الأب، فلا ينتظر نهايةَ الفصل ليعرف. |
| 5.2 | Zoom on the attendance rate, memorization and the juz 30 test. | He sees his son's attendance, what he has memorized, and his result in the juz thirty test. | يرى نسبةَ حضور ابنه، وما حفظه، ونتيجةَ اختبار الجزء الثلاثين. |
| 5.3 | الإشعارات, one by one. | Notifications come to him: a test result, new homework, and a nightly absence summary. | وتصله الإشعارات: نتيجةُ اختبار، وواجبٌ جديد، وملخّصُ الغياب كلَّ ليلة. |
| 5.4 | Fill the excuse form and send it. | If his son must miss a class, he sends the excuse from his phone. Once the شَيْخْ accepts it, the absence is marked excused. | وإن احتاج ابنُه إلى غياب، يرسل عذره من هاتفه… وحين يقبله الشيخ، يصبح الغيابُ بعذر. |
| 5.5 | Hold on the page with only his own child. | And every father sees his own children. No one else's. | وكلُّ أبٍ يرى أبناءه هو فقط. |

## 6 · Made for the mosque (3:45–4:05)

**Screen:** Desktop. Switch to English and back, then step through the themes.

| # | Voiceover | Subtitle |
|---|---|---|
| 6.1 | Arabic first, and English too. | بالعربية أولاً، وبالإنجليزية أيضاً. |
| 6.2 | With designs drawn from the Prophet's Mosque, Iznik tiles, the Alhambra, the mushaf page and the night prayer. | بتصاميمَ مستوحاةٍ من المسجد النبويّ، وخزف إزنيق، وقصر الحمراء، وصفحة المصحف، وليل القيام. |
| 6.3 | And it installs on the phone like any app. | ويُثبَّت على الهاتف كأيِّ تطبيق. |

## 7 · Under the surface (4:05–4:30)

**Screen:** Motion cards on the lattice: the stack and the test results, in English.

| # | Voiceover | Subtitle |
|---|---|---|
| 7.1 | Under the surface, the engineering is solid. | وتحت الواجهة، هندسةٌ متينة. |
| 7.2 | NestJS, PostgreSQL and Prisma on the server. React, and an offline-first web app on the phone. | NestJS وPostgreSQL وPrisma في الخادم، وReact مع تطبيقٍ يعمل دون اتصال على الهاتف. |
| 7.3 | Every mosque is fully isolated from the others, and every action is recorded. | كلُّ مسجدٍ معزولٌ تماماً عن غيره، وكلُّ عمليّةٍ مسجَّلة. |
| 7.4 | And sync is tested against what a real class throws at it: two phones on one student, or a clock a whole day off. | والمزامنةُ مختبَرةٌ ضدّ ما قد يحدث في الحلقة: هاتفان على طالبٍ واحد، أو ساعةٌ متأخّرةٌ يوماً كاملاً. |
| 7.5 | And it's open source. | ومفتوحُ المصدر. |

## 8 · Close (4:30–4:45)

**Screen:** The shamsa settles; «رباط» in gold; `github.com/Salad-man3/ribat` underneath.

| # | Voiceover | Subtitle |
|---|---|---|
| 8.1 | رِباطْ. For every lesson taught in the mosque, and every ayah memorized. | رباط… لكلِّ درسٍ يُعلَّم في المسجد، ولكلِّ آيةٍ تُحفَظ. |
| 8.2 | We're looking for a mosque to join our first pilot. | ونبحث عن مسجدٍ يشاركنا التجربةَ الأولى. |

---

## Music and sound sources (no strings, no wind instruments)

| Need | Where to look | Check |
|---|---|---|
| A cappella humming bed | Pixabay (search "acapella", "humming", "vocal pad"); Aswati Studio (instrument-free anasheed library, paid) | Vocals only, no hidden synth strings |
| Light daf | Pixabay / Freesound ("daf", "frame drum") | Percussion only |
| Courtyard ambience | Freesound ("courtyard birds", "fountain") | CC0 or CC-BY with credit |
| UI clicks | Freesound ("soft click", "tap") | CC0 |
