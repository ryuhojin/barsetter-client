import { copyFile, mkdir, readdir } from "node:fs/promises";
import { join, parse } from "node:path";

const distDir = new URL("../dist/", import.meta.url);
const jsonDir = new URL("../dist/json/", import.meta.url);
const indexFile = new URL("../dist/index.html", import.meta.url);

const files = await readdir(jsonDir);
const jsonFiles = files.filter((file) => file.endsWith(".json"));

for (const file of jsonFiles) {
  const slug = parse(file).name;
  const routeDir = new URL(`../dist/${slug}/`, import.meta.url);
  await mkdir(routeDir, { recursive: true });
  await copyFile(indexFile, new URL(`../dist/${slug}/index.html`, import.meta.url));
  await copyFile(indexFile, join(distDir.pathname, `${slug}.html`));
}
