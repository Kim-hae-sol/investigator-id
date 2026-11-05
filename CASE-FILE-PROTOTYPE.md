# CASE FILE : HNJ — desk prototype

## Preservation and recovery
- Recovery branch: `backup/before-case-file-a7346f8`, commit `a7346f8`.
- `app.js`, ID styles, corridor geometry/cameras, access.js/access.css, recorded walking audio and door authentication are unchanged.
- The live room is still real Three.js geometry, connected to the same renderer and camera.
- No subject portrait, silhouette, voice or interview was created. The facing subject chair is hidden; the investigator chair remains.

## Modules
- `interrogation-room.js`: existing room plus small physical cassette, neutral photo card, note and existing coffee; label `CASE FILE : HNJ`.
- `room-entry.js`: existing door/approach/sitting flow retained. Desk camera bridge provides projection and continuous 650ms transition to near-overhead reading pose. Front-facing gaze control is retired for this desk-only experience.
- `case-data.js`: seven editorial sections (not seven fixed sheets), photo URL, note. `content:null` explicitly means pending.
- `case-sections.js`: independent section renderer registry; future photo envelope, interview and filmography can register renderers without changing navigation.
- `case-file.js`: projected physical object hit areas, short photo displacement, document reading layer, index/previous/next, photo/note dialog, close-to-desk, cassette state.
- `case-file.css`: two-leaf paper folio, restrained paper grain, compact index, basic responsive sizing, reduced-motion support.
- `room-music.js`: only deliberate cassette playback of the existing owner-supplied track. No automatic doorway playback. Global mute is respected; playback intent survives file open/close and pauses when backgrounded.
- `package.py`: includes all new modules in source ZIP and standalone HTML. No build/CDN required; Pages root layout retained.

## Layers / future extensions
Physical desk remains live 3D. Reading uses an accessible HTML folio over the real overhead desk; it does not replace the room with an image. `case-evidence-layer` is reserved for loose evidence. No drag/drop or finalized evidence-envelope animation is claimed. The spread is a provisional two-leaf reading layout, not final chapter pagination. Data is inserted as text, not unsanitized HTML.

## Owner assets still needed
1. Authorized original HNJ photograph: set `photo` in `case-data.js`; null keeps a neutral printed card. No generated face is used.
2. Confirm the rights and final selection for the existing `assets/tunetank-jazz-spy-music-349626.mp3`; it was already supplied in this project, not newly sourced. Replace with your cleared audio if needed.
3. Approved section text, real quotations/interviews, filmography and evidence photos. No biography or quotations were fabricated.
4. Decide eventual leaf count, spreads, chapter artwork, photo envelope behavior and loose-document interactions.

## Validation scope
Local browser exercised retained issued identity → corridor → original card selection/insertion → unlock → physical door → sitting/desk. Photo-first path, file opening, chapter jump and next navigation were exercised. Further final checks are recorded in the delivery message; do not infer unperformed device/audio checks from source inspection.
