import { visit } from "unist-util-visit";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StackIcon from "tech-stack-icons";

// Map code fence language → tech-stack-icons name (null = no icon available)
const LANG_ICON = {
  rust: "rust",
  scala: "scala",
  typescript: "typescript",
  javascript: "js",
  haskell: "haskell",
  python: "python",
  bash: "bash",
  sh: "bash",
  shell: "bash",
  json: "json",
  astro: "astro",
};

const LANG_LABEL = {
  rust: "Rust",
  scala: "Scala",
  typescript: "TypeScript",
  javascript: "JavaScript",
  haskell: "Haskell",
  python: "Python",
  bash: "Bash",
  sh: "Shell",
  shell: "Shell",
  sql: "SQL",
  json: "JSON",
  toml: "TOML",
  yaml: "YAML",
  astro: "Astro",
  cpp: "C++",
  xml: "XML",
};

function renderIcon(iconName) {
  if (!iconName) return "";
  try {
    return renderToStaticMarkup(
      React.createElement(StackIcon, { name: iconName, variant: "light" })
    );
  } catch (e) {
    console.error(`[rehype-code-blocks] icon "${iconName}":`, e.message);
    return "";
  }
}

function getBadgeHtml(lang) {
  const key = lang ? lang.toLowerCase().split(" ")[0] : null;
  const iconName = key ? (LANG_ICON[key] ?? null) : null;
  const label = key ? (LANG_LABEL[key] ?? key.toUpperCase()) : "Code";
  const iconHtml = renderIcon(iconName);

  return `<div class="code-lang-badge">${
    iconHtml ? `<span class="code-lang-icon">${iconHtml}</span>` : ""
  }<span class="code-lang-label">${label}</span></div>`;
}

// Remark plugin — runs BEFORE remarkShiki, collects languages from code nodes
// in document order so rehypeCodeBlocks can match them positionally.
export function remarkCollectCodeLangs() {
  return function (tree, file) {
    file.data.codeLangs = [];
    visit(tree, "code", (node) => {
      file.data.codeLangs.push(node.lang || null);
    });
  };
}

// Rehype plugin — wraps each Shiki-generated pre with a badge + outer div.
// Astro 2.x Shiki doesn't embed the language in the HTML, so we read from
// the list collected by remarkCollectCodeLangs above.
export function rehypeCodeBlocks() {
  return function (tree, file) {
    const langs = file.data.codeLangs || [];
    let codeIndex = 0;

    visit(tree, "raw", (node) => {
      if (!node.value.includes("astro-code")) return;

      const lang = langs[codeIndex++] || null;
      const badge = getBadgeHtml(lang);

      node.value = `<div class="code-wrapper">${badge}${node.value}</div>`;
    });
  };
}
