/**
 * GLSL 预处理工具：忠实移植 three-geospatial 的 resolveIncludes + unrollLoops。
 *
 * - resolveIncludes：递归解析 `#include "path"` 与 `#include <name>` 两种语法，
 *   从传入的嵌套 includes 对象里取字符串替换。参考实现只支持双引号，这里扩展
 *   支持尖括号（three 内置 chunk 语法，如 `#include <common>`）。
 * - unrollLoops：展开 `#pragma unroll_loop_start ... #pragma unroll_loop_end`，
 *   把 `[i]` / `UNROLLED_LOOP_INDEX` 替换成具体索引（与 three r170 行为一致）。
 */

// 同时匹配 #include "a/b" 与 #include <a>
const includePattern = /^[ \t]*#include +(?:"([\w\d./]+)"|<([\w\d./]+)>)/gm;

export function resolveIncludes(source, includes) {
  return source.replace(includePattern, (match, quoted, angled) => {
    const path = quoted ?? angled;
    const components = path.split("/");
    const include = components.reduce(
      (parent, component) =>
        typeof parent !== "string" && parent != null
          ? parent[component]
          : undefined,
      includes,
    );
    if (typeof include !== "string") {
      throw new Error(`Could not find include for ${path}.`);
    }
    return resolveIncludes(include, includes);
  });
}

const unrollLoopPattern =
  /#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*(?:i\s*\+\+|\+\+\s*i)\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;

function loopReplacer(match, start, end, snippet) {
  let string = "";
  for (let i = parseInt(start, 10); i < parseInt(end, 10); ++i) {
    string += snippet
      .replace(/\[\s*i\s*\]/g, `[${i}]`)
      .replace(/UNROLLED_LOOP_INDEX/g, `${i}`);
  }
  return string;
}

export function unrollLoops(string) {
  return string.replace(unrollLoopPattern, loopReplacer);
}

/**
 * 把 defines 对象拼成 GLSL `#define` 头部串。
 * value 为 true → `#define KEY`；false/null/undefined → 跳过；其余 → `#define KEY value`。
 */
export function definesToGlsl(defines) {
  let out = "";
  for (const [key, value] of Object.entries(defines)) {
    if (value === false || value == null) {
      continue;
    }
    if (value === true) {
      out += `#define ${key}\n`;
    } else {
      out += `#define ${key} ${value}\n`;
    }
  }
  return out;
}
