import { Octokit } from "@octokit/rest";

async function run() {
  const {
    GH_TOKEN,
    TARGET_OWNER,
    TARGET_REPO,
    PR_TITLE = "Agent: automated PR",
    BRANCH_NAME = `agent/update-${Date.now()}`,
    FILE_PATH = "AGENT_CHECK.txt",
    COMMIT_MESSAGE = "chore(agent): update AGENT_CHECK",
    FILE_CONTENT = `Updated by agent at ${new Date().toISOString()}\n`
  } = process.env;

  if (!GH_TOKEN) throw new Error("Missing GH_TOKEN");
  if (!TARGET_OWNER || !TARGET_REPO) throw new Error("Missing TARGET_OWNER or TARGET_REPO");

  const octo = new Octokit({ auth: GH_TOKEN });

  // 1) Get default branch SHA
  const { data: repo } = await octo.repos.get({ owner: TARGET_OWNER, repo: TARGET_REPO });
  const baseBranch = repo.default_branch;
  const { data: ref } = await octo.git.getRef({
    owner: TARGET_OWNER, repo: TARGET_REPO, ref: `heads/${baseBranch}`
  });

  // 2) Create a new branch from default
  await octo.git.createRef({
    owner: TARGET_OWNER, repo: TARGET_REPO,
    ref: `refs/heads/${BRANCH_NAME}`, sha: ref.object.sha
  });

  // 3) Check if file already exists (to get its sha)
  let sha = undefined;
  try {
    const { data: file } = await octo.repos.getContent({
      owner: TARGET_OWNER, repo: TARGET_REPO, path: FILE_PATH, ref: baseBranch
    });
    if ("sha" in file) sha = file.sha;
  } catch {
    // file not found on base branch — that's fine
  }

  // 4) Create or update file on the new branch
  await octo.repos.createOrUpdateFileContents({
    owner: TARGET_OWNER, repo: TARGET_REPO, path: FILE_PATH,
    message: COMMIT_MESSAGE,
    content: Buffer.from(FILE_CONTENT, "utf8").toString("base64"),
    branch: BRANCH_NAME,
    sha
  });

  // 5) Open a pull request
  const pr = await octo.pulls.create({
    owner: TARGET_OWNER, repo: TARGET_REPO,
    title: PR_TITLE,
    head: BRANCH_NAME,
    base: baseBranch,
    body: "Automated PR created by Dev PR Agent."
  });

  console.log(`Opened PR: ${pr.data.html_url}`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
