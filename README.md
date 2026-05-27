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

The React app reads `/json/{bar-slug}.json` and renders the menu. Each JSON file may include `presentation.theme` and `presentation.features` so each bar can vary its concept and visible menu behavior without changing the client build.

## Local Run

```bash
npm install
npm run dev
```

Sample:

```txt
http://127.0.0.1:5173/sample-malt-bar
```
