# negaflow-site

[negaflow](https://github.com/habinsong/negaflow) 웹 페이지. GitHub Pages로
<https://habinsong.github.io/negaflow-site/> 에서 서비스한다.

## 구조

`index.html` 하나가 템플릿이자 영어 페이지다. 본문 문구는 `assets/js/i18n.js`의
`NF_I18N`에 언어별로 들어 있고, 런타임에는 `data-i18n` 속성을 통해 치환된다.

문제는 검색엔진이 URL 하나만 보기 때문에 나머지 다섯 언어가 색인되지 않는다는 점이다.
그래서 `tools/build.mjs`가 언어별 페이지를 미리 렌더링해 둔다.

```
/                      영어 개요 (템플릿 겸 x-default)
/ko/  /ja/  /zh/  /fr/  /de/

/chroma-engine/        섹션별 페이지. 언어마다 같은 구조로 하나씩
/grainmend/            예) /ko/grainmend/, /ja/comparison/
/print-layouts/
/film-profiles/
/comparison/

sitemap.xml            36개 URL 전체
robots.txt
```

섹션별 페이지는 `tools/build.mjs`의 `TOPICS`가 정한다. `index.html`에서 해당
`<section>`을 그대로 들어내고 첫 `<h2>`를 `<h1>`으로 올린 것이라 문구는 전부
`i18n.js`에서 나온다. 개요 페이지의 각 섹션에는 `data-topic` 링크가 붙어 있고
빌드가 언어에 맞는 주소를 채운다.

`/<lang>/` 페이지는 `data-lang-locked="1"`이 붙어 URL의 언어를 그대로 유지하고,
`data-base="../"`로 자산 경로를 보정한다. 루트는 잠기지 않아서 기존처럼 브라우저
언어를 감지한다. 언어 메뉴는 이제 해당 언어의 URL로 이동한다.

## 빌드

```bash
node tools/build.mjs          # 생성 파일 쓰기
node tools/build.mjs --check  # 생성 파일이 최신인지 검사 (CI에서 사용)
```

**`index.html`의 `<!-- nf:head:start -->` ~ `<!-- nf:head:end -->` 구간과
언어 디렉터리, 섹션별 페이지 디렉터리, `sitemap.xml`, `robots.txt`는 생성물이다.**
직접 고치지 말고 템플릿이나 `i18n.js`를 고친 뒤 빌드를 다시 돌린다.

`assets/js/*.js`나 `assets/css/style.css`를 고치면 `index.html`의 `?v=` 값을
올린 다음 빌드한다.

## 검색엔진 등록

`tools/build.mjs` 상단 `VERIFICATION`에 소유 확인 토큰을 넣고 빌드하면 모든
페이지의 `<head>`에 메타 태그가 들어간다.

| 서비스 | 주소 |
|---|---|
| Google Search Console | <https://search.google.com/search-console> |
| Bing Webmaster Tools | <https://www.bing.com/webmasters> |
| 네이버 서치어드바이저 | <https://searchadvisor.naver.com> |

등록 후 사이트맵 주소 `https://habinsong.github.io/negaflow-site/sitemap.xml`을
각 콘솔에 제출한다.

> 프로젝트 페이지라 `robots.txt`는 `habinsong.github.io/robots.txt`에 있어야
> 크롤러가 읽는다. 저장소 안의 `robots.txt`는 지금은 참고용이고, 사이트에 자체
> 도메인을 붙이면 그대로 유효해진다. 그때까지 사이트맵은 콘솔에 직접 제출한다.

## 자체 도메인으로 옮길 때

`tools/build.mjs`의 `ORIGIN`과 `BASE_PATH`만 바꾸고 다시 빌드한다.
canonical, hreflang, Open Graph, JSON-LD, 사이트맵이 모두 따라간다.
