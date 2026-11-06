# 확보한 가구 모델 — 2026-11-01

모두 Poly Haven의 CC0 원본입니다. 구매/구독/외부 런타임 요청은 필요 없습니다.

| 모델 | 제작자 · 원본 | 실제 사용 |
| --- | --- | --- |
| Modern Arm Chair 01 | Vibrant Nordic · https://polyhaven.com/a/modern_arm_chair_01 | 1K PBR, 약 8.9K triangles, 서로 마주 보는 두 의자. 원본 목재 프레임·가죽 쿠션·노멀·ARM(AO/roughness/metal) 사용 |
| Dining Table | Aron Łyczek · https://polyhaven.com/a/dining_table | 2K PBR 탁자, 체크무늬 천 노드는 제외. 약 1K triangles 원본, 긴 방향 회전 및 방에 맞춘 비율 조절, 목재 색 조정 |

https://polyhaven.com/license · https://creativecommons.org/publicdomain/zero/1.0/

`chair/source.gltf`, `table/source.gltf`와 각 `.bin`, `textures/`는 실제 다운로드한 원본입니다.
`chair-asset.js`, `table-asset.js`는 glTF 메타데이터와 같은 원본 바이너리를 base64로 감싼 코드입니다.
`static-model.js`는 이 두 정적 모델에 필요한 버퍼·인덱스·UV·PBR 연결만 읽습니다.
애니메이션, Draco, sparse/interleaved accessor를 지원한다고 가정하지 않습니다.
모든 모델 이미지는 HTML의 숨겨진 이미지 뱅크에서 로딩하여 단일 HTML 패키징도 가능합니다.
인물 모델이나 인물 사진은 포함하지 않습니다.

### Cassette tape
[ Cassette Player — Oday Abuzaeed / Poly Haven ](https://polyhaven.com/a/cassette_player), CC0.
The independent tape mesh and its three 1K JPEG maps are retained. The mesh buffer is repacked
in `tape-asset.js` for the existing offline loader. The hinged recorder body is project geometry.
