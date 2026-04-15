import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const projectRoot = process.cwd();
const standaloneDir = path.join(projectRoot, ".next", "standalone");
const standaloneServerPath = path.join(standaloneDir, "server.js");
const standaloneNextDir = path.join(standaloneDir, ".next");
const buildStaticDir = path.join(projectRoot, ".next", "static");
const standaloneStaticDir = path.join(standaloneNextDir, "static");
const publicDir = path.join(projectRoot, "public");
const standalonePublicDir = path.join(standaloneDir, "public");

if (!existsSync(standaloneServerPath)) {
  throw new Error(
    "Missing .next/standalone/server.js. Run `next build` before starting the standalone server."
  );
}

process.env.HOSTNAME = process.env.HOSTNAME || "0.0.0.0";
process.env.PORT = process.env.PORT || "3000";

mkdirSync(standaloneNextDir, { recursive: true });

if (existsSync(buildStaticDir)) {
  cpSync(buildStaticDir, standaloneStaticDir, {
    recursive: true,
    force: true,
  });
}

if (existsSync(publicDir)) {
  cpSync(publicDir, standalonePublicDir, {
    recursive: true,
    force: true,
  });
}

await import(pathToFileURL(standaloneServerPath).href);