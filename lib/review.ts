import { ghFetch } from "./github";

export type ReviewReport = {
  repo: string; pr: number; title: string; author: string;
  additions: number; deletions: number; filesTotal: number;
  byType: Record<string, number>;
  bigFiles: Array<{filename:string, additions:number, deletions:number, changes:number}>;
  binaries: string[]; renamed: string[];
  risky: Array<{filename:string, hits:string[] }>;
  notes: string[];
};

const RISKY_PATTERNS: Array<[string, RegExp]> = [
  ["hardcoded secret", /\b(AIza|AIza|sk-|ghp_|gho_|AWS|AKIA|ASIA|SECRET|TOKEN|PASSWORD)\b/i],
  ["eval()", /\beval\s*\(/i],
  ["Function constructor", /\bnew\s+Function\s*\(/i],
  ["child_process", /\bchild_process\b/i],
  ["fs.writeFile", /\bfs\.writeFile(Sync)?\b/i],
  ["DROP TABLE", /\bDROP\s+TABLE\b/i],
  ["any", /\b:\s*any\b/],
  ["ts-nocheck", /@ts-nocheck/],
];

function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i > -1 ? name.slice(i + 1).toLowerCase() : "(noext)";
}

export async function fetchPR(repo: string, pr: number) {
  const [prRes, filesRes] = await Promise.all([
    ghFetch(`/repos/${repo}/pulls/${pr}`),
    ghFetch(`/repos/${repo}/pulls/${pr}/files?per_page=300`)
  ]);
  if (!prRes.ok) throw new Error(`PR meta ${prRes.status}`);
  if (!filesRes.ok) throw new Error(`PR files ${filesRes.status}`);
  const meta = await prRes.json();
  const files = await filesRes.json();
  return { meta, files };
}

export function analyze(repo: string, pr: number, meta: any, files: any[]): ReviewReport {
  let additions = 0, deletions = 0;
  const byType: Record<string, number> = {};
  const bigFiles: ReviewReport["bigFiles"] = [];
  const binaries: string[] = [];
  const renamed: string[] = [];
  const risky: ReviewReport["risky"] = [];
  const notes: string[] = [];

  for (const f of files) {
    const ext = extOf(f.filename);
    byType[ext] = (byType[ext] || 0) + 1;
    additions += f.additions || 0; deletions += f.deletions || 0;

    const changes = (f.additions || 0) + (f.deletions || 0);
    if (changes >= 300) bigFiles.push({ filename: f.filename, additions: f.additions||0, deletions: f.deletions||0, changes });

    if (f.status === "renamed") renamed.push(`${f.previous_filename} → ${f.filename}`);
    if (f.patch == null) binaries.push(f.filename);

    if (f.patch) {
      const hits = RISKY_PATTERNS.filter(([, re]) => re.test(f.patch)).map(([name]) => name);
      if (hits.length) risky.push({ filename: f.filename, hits });
    }
  }

  if (additions + deletions > 2000) notes.push("Large PR: consider splitting into smaller changes.");
  if ((byType["ts"]||0) + (byType["tsx"]||0) > 30) notes.push("Many TS files changed—ensure type checks/CI pass.");
  if (binaries.length) notes.push("Binary files detected—review for unintended assets.");

  return { repo, pr, title: meta.title || "", author: meta.user?.login || "unknown",
    additions, deletions, filesTotal: files.length, byType, bigFiles, binaries, renamed, risky, notes };
}

export function renderSummary(r: ReviewReport) {
  const fmt = (arr: string[]) => arr.length ? arr.slice(0,8).map(s=>`  • ${s}`).join("\n") : "  • (none)";
  const typeRows = Object.entries(r.byType).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>`  • ${k}: ${v}`).join("\n") || "  • (none)";
  const big = r.bigFiles.slice(0,8).map(f=>`  • ${f.filename} (+${f.additions}/-${f.deletions}, Δ=${f.changes})`).join("\n") || "  • (none)";
  const risk = r.risky.slice(0,10).map(x=>`  • ${x.filename}: ${x.hits.join(", ")}`).join("\n") || "  • (none)";

  return `### PR Review: ${r.repo}#${r.pr}
**Title:** ${r.title}
**Author:** @${r.author}

**Scope:** ${r.filesTotal} files, +${r.additions}/-${r.deletions}

**By Type**
${typeRows}

**Large Files (Δ≥300)**
${big}

**Binary Files**
${fmt(r.binaries)}

**Renames**
${fmt(r.renamed)}

**Risky Matches**
${risk}

**Notes**
${fmt(r.notes)}
`;
}
