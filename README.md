# negaflow-site

negaflow 제품 소개 페이지. 빌드 도구 없는 정적 파일이라 그대로 GitHub Pages에 올리면 됩니다.

```
index.html
assets/css/style.css
assets/js/i18n.js      # 6개 언어 문안
assets/js/app.js       # 언어/외관 전환, 스크롤 연출
assets/shots/          # 화면 스크린샷 (6개 언어 × 2개 모드)
assets/icon-*.webp     # 앱 아이콘
.nojekyll
```

## 로컬 확인

```bash
python3 -m http.server 4173
```

## 배포

1. 이 폴더를 저장소로 올립니다.
2. Settings → Pages → Source를 `Deploy from a branch`, 브랜치를 `main`, 폴더를 `/ (root)`로 지정합니다.

`.nojekyll`이 있어야 Jekyll이 파일을 건드리지 않습니다.

## 문안 수정

문안은 전부 `assets/js/i18n.js` 한 곳에 있습니다. `index.html`의 `data-i18n` 키와 짝을 맞춰
6개 언어(`ko` `en` `ja` `zh` `fr` `de`)를 각각 고칩니다. 한국어가 원문이고 나머지는 번역본입니다.

## 스크린샷 교체

원본 PNG를 다음 규칙으로 다시 인코딩해 `assets/shots/`에 넣습니다.
파일명은 `<화면>-<언어>-<모드>.webp` 입니다.

```bash
cwebp -q 74 -m 6 -resize 2000 0 원본.png -o library-ko-dark.webp
```

설정 화면만 가로 1400으로 줄입니다. 크기가 바뀌면 `index.html`의 `width`/`height` 속성도
같이 고쳐야 로딩 중 레이아웃이 흔들리지 않습니다.

## 언어와 외관

- 처음 방문하면 영어와 시스템 외관을 사용합니다.
- 사용자가 고르면 `localStorage`(`nf-lang`, `nf-scheme`)에 남습니다.
- 외관은 자동 / 라이트 / 다크 세 가지이고, 자동일 때 시스템 설정이 바뀌면 즉시 따라갑니다.
