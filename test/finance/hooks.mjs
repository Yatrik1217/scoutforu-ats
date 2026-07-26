import { pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../../src");
export async function resolveHook(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return { url: pathToFileURL(`${SRC}/${specifier.slice(2)}.ts`).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
export { resolveHook as resolve };
