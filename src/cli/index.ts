#!/usr/bin/env bun
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(
  readFileSync(join(import.meta.dirname, "../../package.json"), "utf-8"),
) as { version: string };

const program = new Command();

program
  .name("flowctl")
  .description("Workflow orchestration for Cursor (TypeScript engine)")
  .version(pkg.version, "-v, --version", "Show version number");

program.parse(process.argv);
