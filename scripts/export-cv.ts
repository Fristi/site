import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { cv } from "../src/cv/data.ts";
import type { Cv } from "../src/cv/types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cvDir = join(root, "cv");
const publicCvDir = join(root, "public", "cv");
const jsonPath = join(cvDir, "cv.json");
const typPath = join(cvDir, "cv.typ");
const pdfPath = join(publicCvDir, "mark-de-jong.pdf");
const docxPath = join(publicCvDir, "mark-de-jong.docx");

const accent = "2563EB";
const muted = "6B7280";

mkdirSync(cvDir, { recursive: true });
mkdirSync(publicCvDir, { recursive: true });
writeFileSync(jsonPath, JSON.stringify(cv, null, 2) + "\n");
console.log("Wrote", jsonPath);

function heading(text: string) {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "E5E7EB", space: 8 },
    },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 22,
        color: accent,
        font: "Calibri",
      }),
    ],
  });
}

function body(
  text: string,
  opts: { italics?: boolean; color?: string; size?: number } = {},
) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({
        text,
        italics: opts.italics,
        color: opts.color,
        size: opts.size ?? 20,
        font: "Calibri",
      }),
    ],
  });
}

function buildDocx(data: Cv) {
  const children: Paragraph[] = [
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: data.name,
          bold: true,
          size: 48,
          font: "Calibri",
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `${data.websiteLabel}   ${data.githubLabel}`,
          color: muted,
          size: 20,
          font: "Calibri",
        }),
      ],
    }),
    heading("Introduction"),
    ...data.introduction.map((p) => body(p, { size: 21 })),
    heading("Work Experience"),
  ];

  for (const job of data.experience) {
    children.push(
      new Paragraph({
        spacing: { before: 120, after: 40 },
        children: [
          new TextRun({
            text: `${job.role} — ${job.company}`,
            bold: true,
            size: 22,
            font: "Calibri",
          }),
          new TextRun({
            text: `    ${job.period}`,
            color: muted,
            size: 20,
            font: "Calibri",
          }),
        ],
      }),
    );

    for (const bullet of job.bullets) {
      const text = bullet.lead ? `${bullet.lead} — ${bullet.text}` : bullet.text;
      children.push(
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 40 },
          children: [new TextRun({ text, size: 20, font: "Calibri" })],
        }),
      );
    }

    if (job.skills.length > 0) {
      children.push(
        body("Skills: " + job.skills.join(", "), {
          italics: true,
          color: muted,
          size: 16,
        }),
      );
    }
  }

  children.push(heading("Certifications"));
  for (const cert of data.certifications) {
    children.push(body("• " + cert.title, { size: 20 }));
  }

  children.push(heading("Talks"));
  for (const talk of data.talks) {
    children.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({ text: talk.name, bold: true, size: 20, font: "Calibri" }),
          new TextRun({
            text: `  ${talk.description}`,
            size: 20,
            font: "Calibri",
          }),
        ],
      }),
    );
  }

  children.push(heading("Solo Open Source Projects"));
  for (const project of data.projects) {
    children.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: project.name,
            bold: true,
            size: 20,
            font: "Calibri",
          }),
          new TextRun({
            text: `  ${project.description}`,
            size: 20,
            font: "Calibri",
          }),
        ],
      }),
    );
  }

  children.push(
    body(`All projects and talk slides available at ${data.githubLabel}`, {
      color: muted,
      size: 18,
    }),
  );

  children.push(heading("Tech & Methodologies"));
  for (const cat of data.techCategories) {
    children.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: cat.category,
            bold: true,
            size: 20,
            font: "Calibri",
          }),
          new TextRun({
            text: `  ${cat.detail}`,
            size: 20,
            font: "Calibri",
          }),
        ],
      }),
    );
  }

  return new Document({
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: "bullet",
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 180 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 360, bottom: 360, left: 680, right: 680 },
          },
        },
        children,
      },
    ],
  });
}

async function exportDocx() {
  const buffer = await Packer.toBuffer(buildDocx(cv));
  writeFileSync(docxPath, buffer);
  console.log("Wrote", docxPath);
}

function typstReleaseAsset(): string {
  const { platform, arch } = process;
  if (platform === "linux" && arch === "x64") {
    return "typst-x86_64-unknown-linux-musl.tar.xz";
  }
  if (platform === "linux" && arch === "arm64") {
    return "typst-aarch64-unknown-linux-musl.tar.xz";
  }
  if (platform === "darwin" && arch === "x64") {
    return "typst-x86_64-apple-darwin.tar.xz";
  }
  if (platform === "darwin" && arch === "arm64") {
    return "typst-aarch64-apple-darwin.tar.xz";
  }
  throw new Error(`No Typst binary published for ${platform}/${arch}`);
}

async function ensureTypst(): Promise<string> {
  const onPath = spawnSync("typst", ["--version"], { encoding: "utf8" });
  if (onPath.status === 0) {
    return "typst";
  }

  const cacheDir = join(root, "node_modules", ".cache", "typst");
  const cached = join(cacheDir, "typst");
  if (existsSync(cached)) {
    return cached;
  }

  mkdirSync(cacheDir, { recursive: true });
  const asset = typstReleaseAsset();
  const url = `https://github.com/typst/typst/releases/latest/download/${asset}`;
  console.log("Downloading Typst from", url);

  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to download Typst (${response.status} ${response.statusText})`);
  }

  const archive = join(cacheDir, asset);
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()));

  const extract = spawnSync("tar", ["-xJf", archive, "-C", cacheDir, "--strip-components=1"], {
    encoding: "utf8",
  });
  if (extract.status !== 0) {
    throw new Error(`Failed to extract Typst: ${extract.stderr || extract.error}`);
  }

  if (!existsSync(cached)) {
    throw new Error(`Typst binary missing after extract at ${cached}`);
  }
  chmodSync(cached, 0o755);
  return cached;
}

function compilePdf(typstBin: string) {
  const result = spawnSync(typstBin, ["compile", typPath, pdfPath], {
    cwd: cvDir,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`typst compile failed: ${result.stderr || result.error}`);
  }
  console.log("Wrote", pdfPath);
}

await exportDocx();
compilePdf(await ensureTypst());
