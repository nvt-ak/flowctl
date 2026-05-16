import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** flowctl git root (parent of /test/integration). */
export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
