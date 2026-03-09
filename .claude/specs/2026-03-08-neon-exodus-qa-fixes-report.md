# Implementation Report: NEON EXODUS QA 권장 수정사항 반영

## 작업 요약
QA에서 발견된 4가지 이슈(폰트 404, SaveManager 초기화 누락, Player _passives 초기화 누락, i18n locale 연동 누락)를 수정하였다.

## 변경된 파일
| 파일 경로 | 작업 유형 | 변경 내용 |
|---|---|---|
| `neon-exodus/assets/fonts/Galmuri11.woff2` | 추가 | fantasydefence에서 Galmuri11.woff2 폰트 파일 복사 |
| `neon-exodus/js/scenes/BootScene.js` | 수정 | SaveManager import 및 init() 호출 추가, setLocale import 및 저장된 locale 반영 |
| `neon-exodus/js/entities/Player.js` | 수정 | _passives 초기화 추가, addPassive/upgradePassive/_applyPassiveEffects 메서드 추가, getPassiveById import 추가 |

## 스펙 대비 구현 상태
- [x] 폰트 404 에러 수정: Galmuri11.woff2를 assets/fonts/에 복사 (index.html 경로는 이미 올바름)
- [x] BootScene에서 SaveManager.init() 호출 추가
- [x] Player에 _passives = {} 초기화 추가
- [x] Player에 addPassive(), upgradePassive(), _applyPassiveEffects() 메서드 추가
- [x] BootScene에서 SaveManager 초기화 후 저장된 locale 설정 반영

## 빌드/린트 결과
- 빌드: N/A (바닐라 JS 프로젝트, 번들러 없음)
- 린트: N/A

## 알려진 이슈
- LevelUpScene은 여전히 자체 _addPassive/_upgradePassive/_applyPassiveEffect 메서드를 통해 패시브를 관리한다. Player의 새 메서드(addPassive/upgradePassive)와 LevelUpScene의 기존 로직이 공존하는 상태이다. 향후 LevelUpScene에서 Player의 메서드를 호출하도록 리팩토링하면 코드 중복이 해소된다.

## QA 참고사항
- 폰트 확인: 브라우저 개발자 도구 Network 탭에서 Galmuri11.woff2 로드 시 200 응답 확인
- SaveManager 초기화: 로컬스토리지 비운 상태에서 게임 시작 후 neon-exodus-save 키가 생성되는지 확인
- locale 연동: settings.locale을 'en'으로 변경한 뒤 새로고침 시 영어 UI 표시 확인
- _passives 초기화: LevelUpScene에서 패시브 선택 시 오류 없이 동작하는지 확인
