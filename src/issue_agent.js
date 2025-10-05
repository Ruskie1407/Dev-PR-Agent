import { Octokit } from "@octokit/rest";

/**
 * Minimal issue-driven agent.
 * - Reads an instruction (issue title + body, or workflow input)
 * - If OPENAI_API_KEY present: asks LLM for a file plan + contents
 * - Creates a branch, writes/updates files, opens a PR
 *
 * Safe fallback: if no OPENAI_API_KEY, writes/updates AGENT_PLAN.md with the instruction.
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

async function llmPlanAndFiles(instruction) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Fallback: no LLM → single markdown note
    return [{
      path: "AGENT_PLAN.md",
      content:
        `# Agent Plan\n\nInstruction:\n\n${instruction}\n\n(OPENAI_API_KEY not set; created a placeholder plan.)\n`,
    }];
  }

  const prompt = `
You are a senior TypeScript/Next.js dev agent.
Input instruction (user wants a small feature or scaffold):

---
${instruction}
---

Return a JSON array of files to create/update. Each item:
{
  "path": "relative/path.ext",
  "reason": "why the change",
  "content": "FULL FILE CONTENT"
}

Rules:
- Prefer Next.js 14 App Router, TypeScript, Tailwind.
- Keep changes minimal but functional.
- If adding pages, include imports and working components.
- Do not include secrets; use env placeholders if needed.
- Make it buildable.
`;

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: "You generate concrete files for a Next.js/TypeScript repository." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2
    })
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${txt}`);
  }
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content?.trim();

  // Try to parse a JSON array from the model
  let files = [];
  try {
    // Attempt to extract JSON block
    const match = raw.match(/\[[\s\S]*\]/);
    files = JSON.parse(match ? match[0] : raw);
  } catch (e) {
    // Fallback to a single plan file if JSON parse fails
    files = [{
      path: "AGENT_PLAN.md",
      content: `# Agent Plan\n\nInstruction:\n\n${instruction}\n\nModel output:\n\n${raw}\n`
    }];
  }
  return files;
}

async function run() {
  const {
    GH_TOKEN,
    TARGET_OWNER,
    TARGET_REPO,
    ISSUE_NUMBER,
    INSTRUCTION, // optional direct instruction
    PR_TITLE
  } = process.env;

  if (!GH_TOKEN) throw new Error("Missing GH_TOKEN");
  if (!TARGET_OWNER || !TARGET_REPO) throw new Error("Missing TARGET_OWNER or TARGET_REPO");

  const octo = new Octokit({ auth: GH_TOKEN });

  // Gather instruction text
  let instructionText = INSTRUCTION;
  if (!instructionText && ISSUE_NUMBER) {
    const { data: issue } = await octo.issues.get({
      owner: TARGET_OWNER, repo: TARGET_REPO, issue_number: Number(ISSUE_NUMBER)
    });
    instructionText = `Title: ${issue.title}\n\n${issue.body || ""}`;
  }
  if (!instructionText) throw new Error("No INSTRUCTION or ISSUE_NUMBER provided.");

  // Get default branch
  const { data: repo } = await octo.repos.get({ owner: TARGET_OWNER, repo: TARGET_REPO });
  const baseBranch = repo.default_branch;
  const { data: ref } = await octo.git.getRef({
    owner: TARGET_OWNER, repo: TARGET_REPO, ref: `heads/${baseBranch}`
  });

  // Prepare branch
  const branch = `agent/${Date.now()}`;
  await octo.git.createRef({
    owner: TARGET_OWNER, repo: TARGET_REPO,
    ref: `refs/heads/${branch}`, sha: ref.object.sha
  });

  // Ask LLM (or fallback) for files
  const files = await llmPlanAndFiles(instructionText);

  // For each file: create or update on branch
  for (const f of files) {
    const path = f.path;
    const content = f.content ?? f.file_content ?? "";
    // Try to see if file exists on base
    let sha;
    try {
      const { data: existing } = await octo.repos.getContent({
        owner: TARGET_OWNER, repo: TARGET_REPO, path, ref: baseBranch
      });
      if ("sha" in existing) sha = existing.sha;
    } catch (_) { /* not found */ }

    await octo.repos.createOrUpdateFileContents({
      owner: TARGET_OWNER, repo: TARGET_REPO, path,
      message: `chore(agent): update ${path}`,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch,
      sha
    });
  }

  // Open PR
  const pr = await octo.pulls.create({
    owner: TARGET_OWNER, repo: TARGET_REPO,
    title: PR_TITLE || "Agent: implement requested changes",
    head: branch,
    base: baseBranch,
    body: `Instruction:\n\n${instructionText}`
  });

  console.log(`Opened PR: ${pr.data.html_url}`);
}

run().catch(e => { console.error(e); process.exit(1); });
