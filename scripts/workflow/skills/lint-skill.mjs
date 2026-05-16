#!/usr/bin/env bun
/**
 * Canonical entry: delegates to src/skills/lint.ts (Phase 5).
 */
import { runLintSkills } from "../../../src/skills/lint.ts";

process.exit(runLintSkills(process.argv.slice(2)));
