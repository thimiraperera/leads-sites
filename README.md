# Leads sites

Landing pages for lead generation. Each site lives in its own numbered folder and is
self-contained (HTML, CSS, JavaScript and images, no build step).

| Folder | Site |
|---|---|
| [`01/`](01/) | BlinQ demo request page ("See it in action"), dark theme |

## Hosting

The repo is published with GitHub Pages from the `main` branch root, so each folder is
served at `/<folder>/`, for example `/01/`. `.nojekyll` tells Pages to serve the files as they are.

## Adding a site

Create the next folder (`02/`, `03/`, ...) with its own `index.html` and assets, add it to the
table above, commit and push. Pages republishes automatically.
