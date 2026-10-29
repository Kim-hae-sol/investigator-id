# 복도 / 문 앞 대체 이미지 및 룩 참고

현재 에셋은 **내장 ImageGen 도구로 만든 실사풍 룩 개발 플레이트**입니다.
실제 장소를 촬영한 사진으로 표기하지 않습니다. 확정된 촬영본이 준비되면 교체하세요.
인물·텍스트·출입증 슬롯·문 열림은 이미지에 포함하지 않았습니다.

| 파일 | 역할 | 크기 |
| --- | --- | --- |
| `corridor-start.png` | 반복되는 우드 도어, 중앙 소실점, 출발 시점 | 1672 × 941 |
| `door-arrival.png` | 같은 닫힌 문 앞의 근접 시점, 우측 빈 벽 | 1672 × 941 |

두 파일을 같은 이름으로 바꾸면 폴더형 `index.html`에서 즉시 반영됩니다.
개별 경로는 index.html의 `#corridor-plate`와 `#door-plate`에서 변경할 수도 있습니다.
완성 단일 HTML은 이미지를 내장하므로 교체 후 `package.py`를 다시 실행하세요.

같은 문·손잡이·조명·벽 재질을 유지한 짝으로 교체하는 것이 좋습니다.
기본 이동은 corridor-3d.js의 실제 WebGL 3D 공간입니다. 아래 사진 경로는 WebGL 대체 화면에만 적용됩니다.
사진 대체 화면은 corridor-start.png 한 장으로 이어지며 door-arrival.png는 교체용 참고로 유지합니다.
페이드인과 이미지 중첩은 사용하지 않습니다.
새 이미지의 원근이 달라지면 opening.js의 `OPENING.corridorScale` 및
`corridorOffsetY`, opening.css의 `object-position`을 함께 조정하세요.
도착 이미지에서 문 오른쪽 벽은 다음 단계의 출입증 슬롯을 위해 비워 두었습니다.
실제 인터랙션은 현재 구현하지 않았으며 `#door-interaction-layer`가 연결 위치입니다.

## 최종 생성 프롬프트 — 출발

Built-in image_gen · new generation · opaque background.

Use case: photorealistic-natural. Asset type: high-resolution cinematic environment plate for a first-person interactive archive website. Generate ONE photorealistic 16:9 landscape frame, ideally 2560x1440 or larger. A maintained old analog investigation bureau office corridor, warm walnut-brown wooden doors and substantial timber doorframes repeating symmetrically on both sides, charcoal/taupe plaster walls, orderly clean brown stone/linoleum floor with very soft reflections, warm ivory ceiling lights at even intervals. Quiet noir atmosphere, NOT horror or abandoned. Camera at human eye level, exactly centered symmetrical one-point perspective, level verticals, no dutch angle. The one closed wooden investigation-room door at the end is centered at x=50%, with its visual center near y=53%, already moderately close: it should occupy roughly 45% of the image HEIGHT, NOT a tiny distant door. This terminal door is a refined plain dark walnut door with one subtle inset rectangular panel, a small antique brass lever on its right, simple substantial walnut frame. A small warm wall light directly above this door illuminates its wood grain. The wall immediately to the RIGHT of this terminal door is clean and EMPTY with clear room for a future small metal card slot; DO NOT add a slot or access reader now. Side doors form depth without clutter. Moody but properly exposed so walls, frames, wood grain and floor remain legible. Warm film photography, restrained contrast, realistic materials, neutral browns, charcoal, gentle ivory highlights; no green cast. No people, no man, no silhouettes, no hands, no text, no signs, no typography, no logos, no UI, no watermark. No fog, no dirt, no decay, no flickering lights, no red warning lights, no sci-fi technology. This is a spatial set, not a website screenshot. Detail must survive display at 1920x1080. The image will later be paired with a matching closer shot of the exact same terminal door.

## 최종 생성 프롬프트 — 도착

Built-in image_gen · reference edit using corridor-start.png · opaque background.

Use case: precise-object-edit. Edit target: the attached photorealistic corridor plate. Generate a matching 16:9 high-resolution ARRIVAL plate of this EXACT same location, as if the camera has now walked a few steps straight ahead to stand in front of the central end door. The ONLY change is the camera location forward along the corridor axis; keep the exact walnut door, exact inset panel and wood grain character, brass lever on the right, exact walnut frame, charcoal taupe plaster, wood skirting and original warm lighting/materials/color grading. Symmetrical centered eye-level first-person camera, level verticals. Central CLOSED door and its frame should now occupy around 80-85% of the image height (top of frame near 13%, threshold near 96%), centered at x=50%, visual centre y=54%. Show the small existing warm pendant/light just above the door and enough of the surrounding walls on both sides to understand the space. Keep a generous empty patch of real wall immediately to the RIGHT of the door at normal card-reader height for future installation; no device there yet. Only narrow hints of the nearest side doors at the extreme frame edges, most of the receding corridor now behind camera. This is a real closer camera view, not a blurry digital enlargement. Maintain exposure: door wood, frame and adjoining walls all clearly legible in restrained dim warm light. Door remains firmly closed. No people, no subject, no hands, no ID reader, no card slot, no access hardware, no UI, no text, no signs, no fog, no horror, no green light, no extra decorative objects. Preserve all environment identity from the reference.
