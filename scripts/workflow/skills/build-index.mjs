#!/usr/bin/env bun
/**
 * Canonical entry: delegates to src/skills/build-index.ts (Phase 5).
 */
import { runBuildIndex } from "../../../src/skills/build-index.ts";

process.exit(runBuildIndex(process.argv.slice(2)));
