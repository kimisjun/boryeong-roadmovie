# BORYEONG SEA CUT

2026년 7월 27~29일 대천해수욕장 2박 3일 여행을 위한 모바일 우선 정적 웹사이트입니다.

## 포함 기능

- 3일 일정 탭
- 화요일 바다/우천 대체 코스 선택 및 브라우저 로컬 저장
- 네이버에서 확인한 대천해수욕장 주간예보
- 준비물 체크리스트 로컬 저장
- 출발 카운트다운
- 네이버 지도·공식 축제 링크
- Web Share API와 클립보드 폴백

## 로컬 실행

```bash
python3 -m http.server 8766
```

`http://127.0.0.1:8766/`에서 확인합니다.

## 상태 저장 범위

선택한 코스와 체크리스트는 `localStorage`를 사용하므로 같은 브라우저에만 저장됩니다. 다른 기기와 동기화되지 않습니다.

## 사진 출처

Hero photo: [Daecheon Beach, Korea](https://commons.wikimedia.org/wiki/File:Daecheon_Beach,_Korea.jpg), Ken Eckert, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). 크롭 및 색상 오버레이 적용.
