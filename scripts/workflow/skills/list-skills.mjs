#!/usr/bin/env bun
/**
 * Canonical entry: delegates to src/skills/list.ts (Phase 5).
 */
import { runListSkills } from "../../../src/skills/list.ts";

process.exit(runListSkills(process.argv.slice(2)));
