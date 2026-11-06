# Wide worktable / seated room revision

Recovery point: `backup/before-wide-desk-2324ffc` (`2324ffc`).

## Actual changes
- The physical hero tabletop is now 2.3944m wide × 1.3806m deep (previously 1.46 × 2.36). Existing licensed furniture frame retained; rounded top and its geometry remain real 3D.
- The empty facing chair is visible at z=-1.08m, 52cm closer than its old -1.60m position. The nearer table edge ends at -0.6903m; chair sits immediately beyond it. No person or silhouette is created.
- Seated desk eye: 1.29m, z=1.40m, target y=.83m/z=-.10m, vertical FOV46°. The view now includes tabletop and chair instead of a steep view along a long table.
- Reading pose is centralized in room view data; the existing camera interpolates into the real overhead view and returns to the new seated pose. Corridor/entry coordinates and authentication untouched.
- Hero tabletop retains the local scanned walnut albedo/normal/roughness rather than the uniform joinery color override. The leather blotter has smaller physical grain and higher roughness; chair leather reflection/normal strength reduced. Warm fill avoids a blue cast. Key intensity reduced but structural readability retained; no new full-screen effect or darker postprocess was added.
- Re-spaced cup, ledgers, tray, note and cassette to fit the new physical depth. Reduced book stack, remodeled cassette controls/reels/speaker slits, added metal paperclip and sub-millimetre paper corner curl.
- Three neutral photo cards are present. All open the existing placeholder viewer; no original subject photographs exist in the project yet. Primary provided-photo insertion still uses `case-data.js.photo`. No face generated/altered.
- Sliding the photo aside now lowers it onto the blotter, avoiding a floating photo after leaving the thicker file.
- ID issuance, access, corridor, walking, music, file navigation and reader CSS retained. File object projection continues to use actual world coordinates.

## Files
`interrogation-room.js`, `room-entry.js`, `case-file.js`, versioned script refs in `index.html`, packaging documentation registration in `package.py`.

## Reused assets / limits
All textures/models remain local, previously acquired Poly Haven CC0; credits remain in `assets/pbr/CREDITS.md` and `assets/models/CREDITS.md`. No new image, model, library or sound was downloaded/generated.

This is a proportion/material/lighting improvement in the existing real-time renderer. It does not claim photographic film-set fidelity. The room still uses raster shadows and approximate fill/light-card reflections, not baked global illumination or ray tracing. Some background furniture remains procedural and photographs are placeholders. Film-still quality would additionally benefit from an authored high-detail desk/prop set and baked area-light indirect illumination, while retaining the present camera/interaction coordinates. No image-based room substitute was used.
