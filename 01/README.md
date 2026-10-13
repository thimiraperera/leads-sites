# BlinQ leads site

Single landing page for demo requests ("See it in action"). Static HTML, CSS and JavaScript, no build step.
Built from `Blinq_leads_site.html`, split into separate files with the same look and behaviour.

## Layout

```
index.html                 The page (all copy and content lives here)
css/base.css               Design tokens (:root), reset, typography, eyebrow label
css/components.css         Buttons, text link, demo form, steps carousel, FAQ accordion
css/layout.css             Header, section container, footer, mobile sticky CTA
css/sections.css           One block per page section, in page order
css/utilities.css          Scroll-reveal classes added by JavaScript
css/responsive.css         Breakpoints (1080 / 900 / 720 / 640 / 560) and reduced motion
js/carousel.js             18-step carousel: timer dots, arrows, drag, stops at the last card
js/form.js                 Business-type choice, step 2 reveal, submit placeholder
js/video.js                Inline YouTube player in the hero
js/main.js                 Header state, mobile CTA, FAQ, scroll reveal
assets/img/                Logos, favicon, social image, integration wordmarks, swatches
assets/img/icons/          Small UI icons used from CSS
```

Stylesheets are linked in the order above and the order matters: later files rely on overriding
earlier ones (for example `.mobilecta` hides `.button`, and `.reveal` wins over section transitions).

## Editing

- **Carousel steps**: the steps carousel is the "Keep it simple & accurate!" carousel from
  blinq-web-v3.0, restyled for the dark theme. Edit the `<li class="step">` cards in `index.html`;
  dots are generated to match. Each card's icon is a `<use href="#i-...">` pointing at the icon sprite
  at the top of `<body>`. Cards per view: 4 on desktop, 3 from 1080px, 2 from 720px, 1¼ from 560px.
- **Video**: change `data-video-id` on `#videoCover` in `index.html`.
- **Colours and fonts**: `:root` tokens at the top of `css/base.css`.
- **Demo form**: `js/form.js` only shows a confirmation. Wire the submit handler to your CRM or form
  endpoint before going live.
- **Social image**: `og:image` uses a relative path. Set it to the full URL once the page has a domain.

## Images

| File | Used for |
|---|---|
| `blinq-logo-white.webp` | Header (white version of the logo for the dark background) |
| `blinq-logo.webp` | Footer logo box |
| `favicon.webp` | Browser tab icon |
| `og-cover.webp` | Social sharing preview (1200 x 630) |
| `app-*.webp` | Integration logos under the carousel |
| `swatch-*.svg` | Fabric thumbnails in the hero app mockup |
| `icons/select-arrow.svg` | Dropdown arrow in the form |

Logo, favicon, social and integration images come from the `blinq-redesign` repo.

## Running it

Open `index.html` in a browser, or serve the folder (the YouTube player may refuse to play from a
`file://` page, so use a server to test the video):

```
python -m http.server 4173
```

Then open http://localhost:4173/.
