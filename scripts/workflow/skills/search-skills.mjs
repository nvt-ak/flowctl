#!/usr/bin/env bun
/**
 * Canonical entry: delegates to src/skills/search.ts (Phase 5).
 */
import { runSearchSkills } from "../../../src/skills/search.ts";

process.exit(runSearchSkills(process.argv.slice(2)));
