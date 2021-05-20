import { camelCase, trimPrefix } from "@kubernetes-models/string-util";
import { getClassName, getShortClassName } from "../string";
import { posix } from "path";
import { Generator, Definition, OutputFile } from "@kubernetes-models/generate";
import { get, set } from "lodash";

interface KeyMap {
  [key: string]: string | KeyMap;
}

function generate(map: KeyMap, parent = ""): readonly OutputFile[] {
  const path = parent + "index.ts";
  let children: OutputFile[] = [];
  let content = "";

  for (const key of Object.keys(map)) {
    const val = map[key];

    if (typeof val === "string") {
      const target = posix.relative(
        parent,
        "_definitions/" + getClassName(val)
      );
      content += `export * from "${target}";\n`;
      children.push({
        path: parent + getShortClassName(val) + ".ts",
        content: `export * from "${target}";\n`
      });
    } else {
      const exportedName = camelCase(key, ".-");
      content += `import * as ${exportedName} from "./${key}";\n`;
      content += `export { ${exportedName} };\n`;
      children = children.concat(generate(val, parent + key + "/"));
    }
  }

  return [{ path, content }, ...children];
}

function buildGVKMap(defs: readonly Definition[]): { [key: string]: string } {
  const map: { [key: string]: string } = {};

  for (const def of defs) {
    for (const gvk of def.gvk || []) {
      let key = gvk.version;
      if (gvk.group) key = gvk.group + "/" + key;

      if (!map[key]) {
        const val = def.schemaId.split(".").slice(0, -1).join(".");

        map[key] = val;
      }
    }
  }

  return map;
}

const generateAliases: Generator = async (definitions) => {
  const map: KeyMap = {};
  const gvkMap = buildGVKMap(definitions);
  const prefix = "io.k8s.";

  for (const def of definitions) {
    set(map, trimPrefix(def.schemaId, prefix).split("."), def.schemaId);
  }

  for (const key of Object.keys(gvkMap)) {
    const keys = key.split("/");
    const val = get(map, trimPrefix(gvkMap[key], prefix).split("."));

    set(map, keys, val);
  }

  return generate(map);
};

export default generateAliases;
