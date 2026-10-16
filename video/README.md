# Ribat promo video

A 5-minute walkthrough in Arabic with English captions, built from `docs/video/script.md`.
The voice sets the timing: each line is a clip, the recorder waits for it in the real app, and
Remotion places the clips where the recorder logged them.

```bash
npm install
npm run voice              # edge-tts clips + src/lines.json (needs uv)
record/servers.sh          # API on :3100 (ribat_video db) and the web app on :5273
record/all.sh              # reseed ribat_video, then record every role into public/rec
npm run studio             # preview; `npm run render` writes out/ribat.mp4
```

- `record/all.sh sheikh teacher` re-records only those roles.
- `record/sheet.sh teacher` makes a contact sheet, one frame per voiceover line.
- Recording never touches a dev server on :3000/:5173 or the `ribat` database.
- Music: none in v1. Halal tracks (a cappella humming, daf, courtyard ambience) can be dropped into
  `public/music/` and added to `src/Film.tsx`.
