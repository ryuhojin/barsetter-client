import { copyFile, mkdir, readdir } from "node:fs/promises";
import { join, parse } from "node:path";

const distDir = new URL("../dist/", import.meta.url);
const jsonDir = new URL("../dist/json/", import.meta.url);
const indexFile = new URL("../dist/index.html", import.meta.url);

let files = [];
try {
  files = await readdir(jsonDir);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
const jsonFiles = files.filter((file) => file.endsWith(".json"));

for (const file of jsonFiles) {
  const slug = parse(file).name;
  const routeSlug = Buffer.from(slug, "utf8").toString("base64url");
  const routeDir = new URL(`../dist/${routeSlug}/`, import.meta.url);
  await mkdir(routeDir, { recursive: true });
  await copyFile(indexFile, new URL(`../dist/${routeSlug}/index.html`, import.meta.url));
  await copyFile(indexFile, join(distDir.pathname, `${routeSlug}.html`));
}
