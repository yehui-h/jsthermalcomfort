# documentation.js theme

Custom [documentation.js](https://github.com/documentationjs/documentation) theme for jsthermalcomfort.

The live site uses a PyData Sphinx-inspired layout (`index.ejs` plus CSS/JS under `assets/`). GitHub Actions runs `npm run docs` and deploys the HTML to the `gh-pages` branch. Generated output in `docs/` is not committed, except for the hand-written demos in `docs/examples/`.

## Layout

- `index.ejs` — page shell (navbar, sidebars, search)
- `section.ejs`, `section_list.ejs`, `note.ejs`, `paramProperty.ejs` — documentation partials
- `index.js` — theme entry: partitions JSDoc comments and renders pages
- `*.md` — static pages (overview, installation, contributing, …)
- `assets/` — CSS, JS, and images copied into the generated site
