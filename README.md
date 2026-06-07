# Bar Setter Client

Static customer menu for Bar Setter.

## Data Contract

The admin app publishes one JSON file per bar:

```txt
public/json/{bar-slug}.json
```

The customer menu is routed by a base64url-encoded slug token:

```txt
https://barsetter-client.pages.dev/{base64url(bar-slug)}
```

Example:

```txt
baro -> https://barsetter-client.pages.dev/YmFybw
```

The React app decodes the route token, reads `/json/{bar-slug}.json`, and renders the menu. These are static files committed by the admin publisher, not runtime API calls. The build also generates static HTML entry files for each encoded slug, so Cloudflare Pages can serve `/YmFybw` without a Worker fallback.

Each JSON file may include `presentation.theme` and `presentation.features` so each bar can vary its concept and visible menu behavior without changing the client build.

## Android Local Mode

`barsetter-android` embeds the built client assets and opens the local viewer with:

```txt
https://barsetter.local/index.html?source=local
```

In this mode the client does not load the Cloudflare Pages UI. It reads menu data from the Android bridge first, then falls back to:

```txt
/local/menu.json
```

The Android wrapper serves `/local/menu.json` from app internal storage. Updating prices, products, and categories should replace that JSON file, not rebuild the Android app.

## Local Run

```bash
npm install
npm run dev
```

Sample:

```txt
http://127.0.0.1:5173/YmFybw
```
