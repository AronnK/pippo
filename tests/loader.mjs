// Node ESM loader that lets the tests run real app code off-device:
// native Expo modules resolve to inert stubs and the `@/` tsconfig alias is
// reimplemented here, because Node does not read tsconfig paths.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = `${ROOT}src/`;
const STUBS = `${ROOT}tests/stubs/`;

const NATIVE_STUBS = {
  "expo-file-system": "expo-file-system.mjs",
  "expo-sharing": "expo-sharing.mjs",
};

export function resolve(specifier, context, next) {
  const stub = NATIVE_STUBS[specifier];
  if (stub) return { url: `file://${STUBS}${stub}`, shortCircuit: true };
  if (specifier.startsWith("@/")) {
    let path = SRC + specifier.slice(2);
    if (!existsSync(path))
      for (const suffix of [".ts", ".tsx", "/index.ts"])
        if (existsSync(path + suffix)) {
          path += suffix;
          break;
        }
    return { url: `file://${path}`, shortCircuit: true };
  }
  return next(specifier, context);
}
