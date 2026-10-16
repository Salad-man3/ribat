# Ribat — 5-minute pitch and walkthrough

Arabic voiceover (Modern Standard Arabic), English subtitles burned in. Target length 5:00.

- **Voice:** edge-tts `ar-SY-LaithNeural`, rate `-8%`. One clip per numbered line, so each
  clip's length sets the cut and the pauses live in the edit, not in the audio.
  Tashkeel is written only where the voice would otherwise misread a word.
- **Data:** `pnpm db:seed` (مسجد النور, 100 members). Logins: sheikh `+963999001001`, teacher
  `+963999001030`, student `+963999001040`, father `+963999001050`; password `demo-ribat-2026`.
- **Pace:** nothing moves faster than a person reading. Every action holds for at least 1.5 s
  after it lands; the camera zooms to the element being talked about, then eases back out.
  Desktop scenes at 1440×900, phone scenes at 390×844 inside a phone frame.
- **Sound:** no strings and no wind instruments. A cappella humming as the bed, a light daf
  only under the brand reveal and the tech section, real silence for the offline moment, and
  soft UI clicks. Every track's license is checked before use.

---

## 0 · Cold open — the problem (0:00–0:22)

**Screen:** Black. A gold girih line draws itself slowly across an emerald field. Three short
text-free shots of the lattice tightening, one per line.
**Sound:** Ambient courtyard (birds, a distant fountain). No music yet.

| # | Voiceover | Subtitle |
|---|---|---|
| 0.1 | في كلِّ مسجدٍ حَلْقة، تُحفَظ فيها آياتُ الله. | In every mosque there is a circle where the words of God are memorized. |
| 0.2 | لكنّ الدفاترَ تضيع، والغيابَ يُنسى، والأهلُ لا يعرفون أين وصل أبناؤهم. | But notebooks get lost, absences are forgotten, and parents never know how far their children have come. |
| 0.3 | والإنترنتُ في صحنِ المسجد… ضعيف. | And the internet in the mosque courtyard… is weak. |

## 1 · The name (0:22–0:45)

**Screen:** The shamsa medallion turns in slowly; the hadith appears line by line in Amiri,
gold on emerald, with its source underneath. Then «رباط» resolves in Reem Kufi at the centre.
**Sound:** Humming bed fades in; a single daf beat lands on the wordmark.

| # | Voiceover | Subtitle |
|---|---|---|
| 1.1 | قال رسولُ الله صلى الله عليه وسلم: «وكثرةُ الخُطا إلى المساجد، وانتظارُ الصلاةِ بعد الصلاة، فذلكم الرِّباط». | The Prophet ﷺ said: "Many steps to the mosques, and waiting for the next prayer after the prayer — that is ribat." (Muslim) |
| 1.2 | ومن هنا جاء الاسم: رِباط. | That is where the name comes from: Ribat. |
| 1.3 | نظامٌ متكاملٌ لإدارة حلقات التحفيظ ودروس العلم في المسجد. | One complete system for a mosque's Quran circles and lessons. |
| 1.4 | للشيخ، وللمعلّم، وللطالب، ولأهله… كلٌّ يرى ما يخصّه. | For the sheikh, the teacher, the student and the family: each sees what is theirs. |

## 2 · The sheikh (0:45–1:48)

**Screen:** Desktop, theme زمرد with the pattern on. Sign in as the sheikh.

| # | Screen | Voiceover | Subtitle |
|---|---|---|---|
| 2.1 | Overview page settles in; slow push toward the menu. | لنبدأ من مكتبِ الشيخ. | Let's start at the sheikh's desk. |
| 2.2 | الأعضاء: slow scroll through Arabic names, then open a child. | كلُّ أعضاءِ المسجد في مكانٍ واحد: الطلاب، والمعلّمون، والآباء، مع العائلاتِ والإخوة. | Every member of the mosque in one place: students, teachers and fathers, with their families and siblings. |
| 2.3 | Zoom on the access card; issue a setup code; the code appears. | لا يحتاج أحدٌ إلى بريدٍ إلكتروني. يمنحه المسجدُ رمزاً لمرّةٍ واحدة، فيختار كلمةَ مروره بنفسه. | Nobody needs an email address. The mosque gives a one-time code, and the person chooses their own password. |
| 2.4 | Zoom on the private note marked «للشيخ فقط». | وللشيخِ ملاحظاتٌ خاصّة… لا يراها غيرُه. | And the sheikh keeps private notes that no one else sees. |
| 2.5 | الحلقات: the list of ten; open حلقة تحفيظ العصر; pan materials → teachers → students. | عشرُ حلقاتٍ ودروس، لكلٍّ منها معلّمُها وطلابُها وموادُّها، من المصحفِ الشريف إلى المتون. | Ten circles and lessons, each with its teacher, students and materials, from the Quran to the classical texts. |
| 2.6 | Zoom on the schedule row «العصر → المغرب», then on the next four weeks with times shifting by a minute or two. | والجدولُ يتبعُ الصلاةَ لا الساعة: من العصرِ إلى المغرب. ومع تغيُّرِ الفصول، تتحرّكُ الحلقةُ معها. | The schedule follows the prayers, not the clock: from Asr to Maghrib. As the seasons change, the class moves with them. |
| 2.7 | إعدادات المسجد: nudge one prayer by +2 minutes. | ويضبطُ المسجدُ مواقيتَه على أذانِه هو، دقيقةً بدقيقة. | And the mosque sets the times to its own adhan, to the minute. |
| 2.8 | سجل التغييرات: open one row to show before and after. | وكلُّ تغييرٍ مسجَّل: مَن فعله، ومتى. | Every change is recorded: who made it, and when. |

## 3 · The teacher — class mode (1:48–3:02)

**Screen:** Phone frame, theme النبوي. Sign in as the teacher.

| # | Screen | Voiceover | Subtitle |
|---|---|---|---|
| 3.1 | وضع الحلقة: Today, with the «الآن» badge pulsing once. | والآن… إلى الحلقة. يفتحُ المعلّمُ هاتفه، فيجدُ حلقاتِ اليوم، والحلقةَ القائمةَ الآن. | Now, to the circle. The teacher opens their phone and finds today's classes, and the one happening now. |
| 3.2 | Open it. Tap a status for five students, one at a time, with a soft click on each. | التحضيرُ بلمسةٍ واحدةٍ لكلّ طالب: حاضر، غائب، متأخّر، معذور. | Attendance takes one tap per student: present, absent, late, excused. |
| 3.3 | Zoom on the tally bar as the progress line fills. | والعدّادُ في الأسفل يخبرُه كم بقي. | The tally at the bottom shows how many are left. |
| 3.4 | Open «تسجيل» for a student: the surah is already set; change the end ayah, choose «جيد جداً», step mistakes to 1. | ثم التسميع: من أيِّ سورة، ومن أيِّ آيةٍ إلى أيِّ آية. يتحقّقُ رِباط من المدى، ويحسبُ صفحاتِ المصحف تلقائياً. | Then the recitation: which surah, from which ayah to which. Ribat checks the range and works out the mushaf pages by itself. |
| 3.5 | Zoom on the «آخر موضع» line under the name. | ويبدأُ كلُّ طالبٍ من حيثُ توقّفَ آخرَ مرّة. | Each student starts where they stopped last time. |
| 3.6 | Phone status bar shows airplane mode. **The music cuts to silence.** | وإن انقطعَ الإنترنت؟ | And if the internet drops? |
| 3.7 | Hold 1 s of silence. Keep marking; the sync card counts queued changes. | لا شيءَ يتوقّف. | Nothing stops. |
| 3.8 | Airplane mode off; the sync card turns to «أُرسلت كل التغييرات». Humming returns. | كلُّ لمسةٍ تُحفَظ على الهاتف، ثمّ تُرسَلُ حين يعودُ الاتصال… مرّةً واحدة، لا مرّتين. | Every tap is saved on the phone, then sent when the connection returns: once, never twice. |
| 3.9 | دورة التجويد: log explanation pages, then assign homework to the class. | وفي دروسِ الشرح، يسجّلُ المعلّمُ الصفحاتِ التي شرحها، ويُسندُ الواجباتِ للحلقة، أو لطالبٍ بعينه. | In explanation lessons, the teacher records the pages covered and sets homework for the class or for one student. |

## 4 · The student (3:02–3:32)

**Screen:** Phone frame, theme مصحف. Sign in as Layla.

| # | Screen | Voiceover | Subtitle |
|---|---|---|---|
| 4.1 | بوابتي: slow scroll through the week, both calendars visible. | والطالبةُ ليلى ترى أسبوعَها بالتاريخين الهجريِّ والميلاديّ… | Layla, a student, sees her week in Hijri and Gregorian dates… |
| 4.2 | Zoom on the memorization card, then the test scores. | وآخرَ موضعٍ وصلت إليه في المصحف، ونتائجَ اختباراتها، وواجباتِها. | …the last place she reached in the Quran, her test results and her homework. |
| 4.3 | Hold on her progress card. | تعرفُ أين هي… وإلى أين تمضي. | She knows where she is, and where she is going. |

## 5 · The father (3:32–4:16)

**Screen:** Phone frame, theme إزنيق. Sign in as Salim, Layla's father.

| # | Screen | Voiceover | Subtitle |
|---|---|---|---|
| 5.1 | أبناؤك loads; the notifications badge shows 3. | أمّا الأبُ، فلا ينتظرُ نهايةَ الفصلِ ليعرف. | Her father doesn't wait for the end of term to find out. |
| 5.2 | Zoom on the attendance rate, the memorization card and the juz 30 test at 86/100. | يرى نسبةَ حضورِ ابنته، وما حفظتْه، ونتيجةَ اختبارِ الجزءِ الثلاثين. | He sees his daughter's attendance rate, what she has memorized, and her result in the juz 30 test. |
| 5.3 | الإشعارات: the three notifications, one by one. | وتصلُه الإشعارات: نتيجةُ اختبار، وواجبٌ جديد، وملخّصُ الغيابِ كلَّ ليلة. | Notifications reach him: a test result, new homework, and a nightly absence summary. |
| 5.4 | Back to her card: fill the excuse form and send it; it appears as «قيد الانتظار». | وإن احتاجت إلى غياب، يُرسلُ عذرَها من هاتفه… وحين يقبلُه الشيخ، يصبحُ الغيابُ بعذر. | If she needs to be absent, he sends her excuse from his phone, and once the sheikh accepts it, the absence is marked excused. |
| 5.5 | Hold on the page with only his own child on it. | وكلُّ أبٍ يرى أبناءَه هو فقط. | And every father sees his own children, and no one else's. |

## 6 · Made for the mosque (4:16–4:34)

**Screen:** Desktop. Open «المظهر» and step through the themes, one every 1.5 s: زمرد → النبوي → إزنيق
→ الحمراء → مصحف → قيام. Switch the language to English and back. End on the phone home screen
with Ribat installed.

| # | Voiceover | Subtitle |
|---|---|---|
| 6.1 | بالعربيةِ أولاً، وبالإنجليزيةِ أيضاً. | Arabic first, and English too. |
| 6.2 | بتصاميمَ مستوحاةٍ من المسجدِ النبويّ، وخزفِ إزنيق، وقصرِ الحمراء، وصفحةِ المصحف، وليلِ القيام. | With designs drawn from the Prophet's Mosque, Iznik tiles, the Alhambra, the mushaf page and the night prayer. |
| 6.3 | ويُثبَّتُ على الهاتفِ كأيِّ تطبيق. | And it installs on the phone like any app. |

## 7 · Under the surface (4:34–4:54)

**Screen:** Motion cards on the lattice, one per beat. The technology names appear on screen
only; the voice does not read them.

1. `NestJS 11 · PostgreSQL 16 · Prisma · Redis · BullMQ`
2. `React 19 · Vite PWA · Dexie (IndexedDB) · Tailwind CSS 4`
3. `Zod contracts shared by the API and the app`
4. `Every tenant route answers 404 to another mosque: 19 reads, 12 writes`
5. `200 offline changes synced in one request in under 2 s`
6. `Open source · AGPL-3.0`

**Sound:** Light daf under the humming.

| # | Voiceover | Subtitle |
|---|---|---|
| 7.1 | وتحتَ الواجهة، هندسةٌ متينة. | Under the surface, solid engineering. |
| 7.2 | كلُّ مسجدٍ معزولٌ تماماً عن غيره، وكلُّ عمليّةٍ مسجَّلة. | Every mosque is fully isolated from the others, and every action is recorded. |
| 7.3 | والمزامنةُ مختبَرةٌ ضدَّ كلِّ ما قد يحدثُ في الحلقة: هاتفانِ على طالبٍ واحد، أو ساعةٌ متأخّرةٌ يوماً كاملاً. | Sync is tested against what a real class can throw at it: two phones on one student, or a clock a whole day off. |
| 7.4 | ومفتوحُ المصدر. | And it is open source. |

## 8 · Close (4:54–5:08)

**Screen:** Back to the emerald field. The shamsa settles; «رباط» in gold; underneath,
`github.com/Salad-man3/ribat`.
**Sound:** The humming resolves and fades out on the last word.

| # | Voiceover | Subtitle |
|---|---|---|
| 8.1 | رِباط… لأنّ كلَّ آيةٍ تُحفَظ، تستحقُّ أن تُحفَظ. | Ribat. Because every ayah that is memorized deserves to be kept. |
| 8.2 | ونبحثُ عن مسجدٍ يشاركُنا التجربةَ الأولى. | And we are looking for a mosque to join our first pilot. |

---

## Music and sound sources (no strings, no wind instruments)

| Need | Where to look | Check |
|---|---|---|
| A cappella humming bed | Pixabay (search "acapella", "humming", "vocal pad"); Aswati Studio (instrument-free anasheed library, paid) | Vocals only, no hidden synth strings |
| Light daf | Pixabay / Freesound ("daf", "frame drum") | Percussion only |
| Courtyard ambience | Freesound ("courtyard birds", "fountain") | CC0 or CC-BY with credit |
| UI clicks | Freesound ("soft click", "tap") | CC0 |

Pixabay's content license allows commercial use without credit, but read each track's page;
Freesound licenses differ per sound.

## Length check

About 370 spoken words. At `-8%` the Syrian voice reads roughly 2 words a second, so speech is
about 3:05. The other ~2:00 is deliberate breathing room: held shots after each action, the
offline silence, the theme montage and the tech cards. If the first cut feels slow, trim holds
before cutting lines; if it feels rushed, there is room to add a line in 2 or 3.
