// Registers tests/loader.mjs so `node --import ./tests/register.mjs` can run app
// code that imports `@/...` and native Expo modules.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./loader.mjs", pathToFileURL(`${import.meta.dirname}/`));
