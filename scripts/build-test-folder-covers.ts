import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import sharp from "sharp";

/** Original code-native vector artwork, rasterised once to match existing covers. */
const covers = [
  { id: "a1-to-be", level: "A1", lines: ["Present simple", "to be"], accent: "#45d8f7", chips: ["am", "is", "are"], caption: "I am. You are. We are." },
  { id: "a1-a-an-plurals", level: "A1", lines: ["A/an", "& plurals"], accent: "#ffbf69", chips: ["a", "an", "+s"], caption: "One idea. Many possibilities." },
  { id: "a1-demonstratives", level: "A1", lines: ["This, that,", "these, those"], accent: "#6aebc7", chips: ["this", "that", "those"], caption: "Near or far. One or many." },
  { id: "a1-possessives", level: "A1", lines: ["Possessive adjectives", "& subject pronouns"], accent: "#c0a0ff", chips: ["I", "my", "our"], caption: "Who is it? Whose is it?" },
  { id: "a1-adjectives", level: "A1", lines: ["Adjectives:", "the basics"], accent: "#7fb4ff", chips: ["new", "nice", "great"], caption: "Make your sentences more colourful." },
  { id: "third-conditional", level: "B1", lines: ["Third", "conditional"], accent: "#ff718e", chips: ["if", "had", "have"], caption: "Imagine a different past." },
];
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const svgFor = (cover: typeof covers[number]) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600">
<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#111b31"/><stop offset="1" stop-color="#253552"/></linearGradient><radialGradient id="glow"><stop stop-color="${cover.accent}" stop-opacity=".28"/><stop offset="1" stop-color="${cover.accent}" stop-opacity="0"/></radialGradient></defs>
<rect width="1200" height="600" rx="32" fill="url(#bg)"/><circle cx="1020" cy="170" r="350" fill="url(#glow)"/><path d="M0 518Q380 440 760 520T1200 495" fill="none" stroke="${cover.accent}" stroke-opacity=".12" stroke-width="80"/>
<g fill="none" stroke="white" stroke-opacity=".035">${Array.from({ length: 15 }, (_, i) => `<path d="M${i * 90} 0V600"/>`).join("")}${Array.from({ length: 7 }, (_, i) => `<path d="M0 ${i * 90}H1200"/>`).join("")}</g>
<g font-family="Arial, sans-serif"><rect x="64" y="56" width="176" height="44" rx="22" fill="${cover.accent}" fill-opacity=".13" stroke="${cover.accent}" stroke-opacity=".45"/><text x="88" y="86" fill="${cover.accent}" font-size="19" font-weight="700" letter-spacing="3">GRAMMAR</text>
<text x="64" y="221" fill="#f4f7ff" font-size="${cover.id === "a1-possessives" ? 51 : 68}" font-weight="800">${escape(cover.lines[0])}</text><text x="64" y="303" fill="${cover.accent}" font-size="${cover.id === "a1-possessives" ? 51 : 68}" font-weight="800">${escape(cover.lines[1])}</text>
<rect x="64" y="343" width="72" height="6" rx="3" fill="${cover.accent}"/><text x="64" y="402" fill="#b8c8df" font-size="23">${escape(cover.caption)}</text>
<text x="64" y="536" fill="#b8c8df" font-size="18" letter-spacing="3">LINGORA / TEST COLLECTION</text>
<rect x="1043" y="53" width="94" height="64" rx="22" fill="${cover.accent}"/><text x="1090" y="96" text-anchor="middle" fill="#102034" font-size="34" font-weight="800">${cover.level}</text>
</g><g transform="translate(806 159)"><rect x="-12" y="40" width="288" height="286" rx="34" fill="#070d1a" fill-opacity=".32" transform="rotate(-8 130 180)"/><rect width="288" height="304" rx="30" fill="#f5f7ff"/><rect x="22" y="25" width="244" height="40" rx="12" fill="${cover.accent}" fill-opacity=".23"/><path d="M43 45H162" stroke="#1d2d45" stroke-width="7" stroke-linecap="round"/>${cover.chips.map((chip, i) => `<rect x="22" y="${86 + i * 66}" width="244" height="51" rx="13" fill="${i === 1 ? cover.accent : "#e8eef8"}"/><text x="144" y="${121 + i * 66}" fill="#1d2d45" font-family="Arial, sans-serif" font-weight="800" font-size="30" text-anchor="middle">${escape(chip)}</text>`).join("")}<circle cx="256" cy="285" r="38" fill="${cover.accent}"/><path d="M239 285l12 12 24-25" fill="none" stroke="#102034" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;

async function main() {
  const exe = process.env.CODEX_PATCH_EXE;
  if (!exe) throw new Error("Set CODEX_PATCH_EXE to the available Codex apply-patch executable");
  await mkdir("public/images/tests", { recursive: true });
  const metadata = [];
  for (const cover of covers) {
    const svg = svgFor(cover), source = `docs/assets/tests/${cover.id}-v1.svg`, output = `public/images/tests/${cover.id}-v1.webp`;
    const patch = `*** Begin Patch\n*** Add File: ${source}\n${svg.split("\n").map((line) => "+" + line).join("\n")}\n*** End Patch\n`;
    const applied = spawnSync(exe, ["--codex-run-as-apply-patch", patch], { stdio: "inherit" });
    if (applied.status !== 0) throw new Error("Could not save vector artwork");
    const info = await sharp(Buffer.from(svg)).webp({ quality: 88 }).toFile(output);
    metadata.push({ id: cover.id, source, output, width: info.width, height: info.height, bytes: info.size });
  }
  const provenance = JSON.stringify({ method: "Original code-native SVG artwork rendered to WebP; no remote assets or AI image edits", covers: metadata }, null, 2);
  const applied = spawnSync(exe, ["--codex-run-as-apply-patch", `*** Begin Patch\n*** Add File: docs/assets/folder-test-covers.json\n${provenance.split("\n").map((line) => "+" + line).join("\n")}\n*** End Patch\n`], { stdio: "inherit" });
  if (applied.status !== 0) throw new Error("Could not save cover provenance");
  console.log(JSON.stringify(metadata, null, 2));
}
void main();
