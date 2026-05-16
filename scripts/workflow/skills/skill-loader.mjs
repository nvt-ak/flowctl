#!/usr/bin/env bun
/**
 * Canonical entry: delegates to src/skills/loader.ts (Phase 5).
 */
import { runLoadSkill } from "../../../src/skills/loader.ts";

process.exit(runLoadSkill(process.argv.slice(2)));
