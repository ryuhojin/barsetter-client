# Bar Setter Client

Static customer menu for Bar Setter.

## Data Contract

The admin app publishes one JSON file per bar:

```txt
public/json/{bar-slug}.json
```

The customer menu is routed by slug:

```txt
https://barsetters.pages.dev/{bar-slug}
```

The React app reads `/json/{bar-slug}.json` and renders the menu. These are static files committed by the admin publisher, not runtime API calls. The build also generates static HTML entry files for each slug, so Cloudflare Pages can serve `/bar-slug` without a Worker fallback.

Each JSON file may include `presentation.theme` and `presentation.features` so each bar can vary its concept and visible menu behavior without changing the client build.

## Local Run

```bash
npm install
npm run dev
```

Sample:

```txt
http://127.0.0.1:5173/sample-malt-bar
```
