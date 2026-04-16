import { visit } from "unist-util-visit";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
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

/** Parse an HTML string fragment into HAST element nodes. */
function htmlToHastNodes(html) {
  const tree = unified().use(rehypeParse, { fragment: true }).parse(html);
  // Strip position data to keep the tree clean
  visit(tree, (node) => { delete node.position; });
  return tree.children;
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
//
// .md files:  Shiki output stays as "raw" HAST nodes (no rehypeRaw in pipeline)
//             → wrap the HTML string directly.
//
// .mdx files: @astrojs/mdx inserts rehypeRaw BEFORE user plugins, converting
//             "raw" nodes to "element" nodes. hast-util-to-estree (used later
//             by MDX) cannot handle raw nodes, so we build proper HAST elements.
export function rehypeCodeBlocks() {
  return function (tree, file) {
    const langs = file.data.codeLangs || [];
    let codeIndex = 0;

    // .md path — raw HTML string nodes
    visit(tree, "raw", (node) => {
      if (!node.value.includes("astro-code")) return;
      const lang = langs[codeIndex++] || null;
      const badge = getBadgeHtml(lang);
      node.value = `<div class="code-wrapper">${badge}${node.value}</div>`;
    });

    // .mdx path — pre elements already parsed into HAST by rehypeRaw
    const seen = new WeakSet();
    visit(tree, "element", (node, index, parent) => {
      if (seen.has(node)) return;
      if (
        node.tagName !== "pre" ||
        !node.properties?.className?.includes("astro-code")
      ) return;

      seen.add(node);
      const lang = langs[codeIndex++] || null;
      const badgeNodes = htmlToHastNodes(getBadgeHtml(lang));

      const wrapper = {
        type: "element",
        tagName: "div",
        properties: { className: ["code-wrapper"] },
        children: [...badgeNodes, node],
      };
      parent.children.splice(index, 1, wrapper);
    });
  };
}
