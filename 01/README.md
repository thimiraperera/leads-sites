# BlinQ leads site

Single landing page for demo requests ("See it in action"). Static HTML, CSS and JavaScript, no build step.
Built from `Blinq_leads_site.html`, split into separate files with the same look and behaviour.

## Layout

```
index.html                 The page (all copy and content lives here)
css/base.css               Design tokens (:root), reset, typography, eyebrow label
css/components.css         Buttons, text link, demo form, steps carousel
css/layout.css             Header, section container, footer, mobile sticky CTA
css/sections.css           One block per page section, in page order
css/utilities.css          Scroll-reveal classes added by JavaScript
css/responsive.css         Breakpoints (1080 / 900 / 720 / 640) and reduced motion
js/stages.js               How BlinQ works: stage tabs (click, arrow keys, Home / End)
js/testimonials.js         Customer stories: tabs, arrows, 7-second auto-rotation
js/faq.js                  FAQ: topic switching, Expand all / Collapse all
js/form.js                 Business-type choice, step 2 reveal, field checks, sending
js/video.js                Inline YouTube player in the hero
js/main.js                 Header state, mobile CTA, scroll reveal
assets/img/                Logos, favicon, social image, integration wordmarks, swatches
assets/img/icons/          Small UI icons used from CSS
```

Stylesheets are linked in the order above and the order matters: later files rely on overriding
earlier ones (for example `.mobilecta` hides `.button`, and `.reveal` wins over section transitions).

**After changing any CSS or JS file, bump the `?v=` value** on the `<link>` and `<script>` tags in
`index.html` (for example `?v=20261013` to `?v=20261014`). GitHub Pages lets browsers cache these
files for 10 minutes; a new `?v=` makes visitors fetch the updated files straight away.

## Editing

- **How BlinQ works**: 18 steps in 5 stages. Each stage is a `<button class="stages__tab">` plus a
  `<div class="stage" id="stage-N">` panel (story, checklist, buttons, and a workflow card listing its
  steps); keep `stage-tab-N` / `stage-N` in step and update "Stage N of 5" and "Steps 01–03 of 18" if
  stages change. All panels share one grid cell, so the section keeps the height of the tallest stage.
- **Customer stories**: the testimonial carousel from blinq-web-v3.0, restyled for the dark theme.
  Each story is a `<figure class="testi__slide">` with a matching `<button class="testi__tab">`; keep
  the ids in step (`testi-N` / `testi-tab-N`) when adding or removing one. Only quotes published on
  blinq.com.au are used. A client logo goes in `<span class="testi__logo">` (shown on a white tile);
  without a logo, use `<span class="testi__mono">` with the client's initials.
- **FAQ**: 30 questions in 6 topics. Each topic is a `<section class="faqx__panel" id="faq-...">` with
  a matching link in the topic list (`href="#faq-..."`); update the number in `faqx__count` when you
  add or remove a question. Each question is a `<details class="faqx__item">`; the first in each topic
  starts open. Linking to `#faq-pricing` (or any topic id) opens that topic.
- **Video**: change `data-video-id` on `#videoCover` in `index.html`.
- **Colours and fonts**: `:root` tokens at the top of `css/base.css`.
- **Demo form**: `js/form.js` checks the fields and posts them to `/api/demo-request`, the Cloudflare
  Pages Function in `../functions/api/demo-request.js`, which emails them through Gmail. Setup steps
  (Gmail app password, Cloudflare Pages, variables) are in the repo's main README. Where the Function
  isn't running (GitHub Pages, or not configured yet) the form offers an email link to
  support@blinq.com.au with the visitor's details filled in.
- **Social image**: `og:image` uses a relative path. Set it to the full URL once the page has a domain.

## Images

| File | Used for |
|---|---|
| `blinq-logo-white.webp` | Header (white version of the logo for the dark background) |
| `blinq-logo-mono-white.webp` | Footer (all-white logo, sits straight on the dark background) |
| `favicon.webp` | Browser tab icon |
| `og-cover.webp` | Social sharing preview (1200 x 630) |
| `app-*.webp` | Integration logos under the carousel |
| `logos/clients/*.webp` | Client logos in the customer stories |
| `swatch-*.svg` | Fabric thumbnails in the hero app mockup |
| `icons/select-arrow.svg` | Dropdown arrow in the form |

Logo, favicon, social, integration and client logo images come from the `blinq-redesign` repo.

## Running it

Open `index.html` in a browser, or serve the folder (the YouTube player may refuse to play from a
`file://` page, so use a server to test the video):

```
python -m http.server 4173
```

Then open http://localhost:4173/.
