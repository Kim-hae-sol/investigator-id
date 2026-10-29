# 3D 복도 재질

실제 3D 기하에 적용하는 1K PBR 재질입니다. 실행 중에는 외부 서버에 연결하지 않습니다.
파일은 원본 JPEG를 그대로 사용하고, 색상·거칠기·노멀 강도는 corridor-3d.js의 재질에서 조절합니다.

| 로컬 파일 접두사 | Poly Haven 원본 | 용도 |
| --- | --- | --- |
| wood- | [American Walnut Veneer](https://polyhaven.com/a/american_walnut_veneer) | 월넛 문, 문틀, 몰딩 |
| wall- | [White Plaster 02](https://polyhaven.com/a/white_plaster_02) | 도장한 벽과 천장의 미세 표면 |
| floor- | [Terrazzo Tiles](https://polyhaven.com/a/terrazzo_tiles) | 관리된 기관의 테라조 바닥 |

각 재질의 color는 Diffuse, normal은 OpenGL normal, roughness는 Rough 원본입니다.
목재 제작자는 Jenelle van Heerden입니다. 모든 재질은 Poly Haven의 **CC0** 라이선스입니다.
[라이선스](https://polyhaven.com/license) · [CC0 원문](https://creativecommons.org/publicdomain/zero/1.0/)
다운로드 및 라이선스 확인: 2026-10-28.

라이브러리는 Three.js r180 (MIT) 및 공식 Reflector를 로컬 classic script로 감싼 것입니다.
원본 저작권·라이선스는 vendor/THREE-LICENSE.txt에 포함했습니다.
Reflector에는 약한 흐림과 낮은 불투명도를 적용한 셰이더를 전달하며 원본 클래스는 유지합니다.

조정 위치:
- 공간 크기·눈높이·카메라 거리: corridor-3d.js의 SPACE.
- 문 패널·문틀·손잡이: door(). 문은 닫힌 상태로만 구현합니다.
- 광원과 조명 기구: lamp().
- 재질 색상·거칠기·노멀 강도: pbr() 호출부.
- 출입증 슬롯 / 문 열기: 현재 구현하지 않으며 mainDoor mesh와 door-interaction-layer가 다음 연결 지점입니다.

복도 개선에서는 원본 JPEG를 유지하고 물리적 반복 크기, 인스턴스별 목재 UV 위치·미세 색차,
셰이더의 최소 거칠기와 채도를 조절했습니다. CanvasTexture는 문틀·모서리 접촉 음영용 그라데이션에만 사용합니다.
