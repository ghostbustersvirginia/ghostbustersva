const loaderScript =
  document.getElementById("keystatic-preview-banner-loader") ||
  document.querySelector('script[src*="/keystatic-preview-banner.js"]');
const previewProject = loaderScript?.dataset?.previewProject || "ghostbustersva";
const previewTeam = loaderScript?.dataset?.previewTeam || "afton-gauntletts-projects";
const localGitBranch = loaderScript?.dataset?.localBranch || "";

const queryBranchKeys = ["branch", "ref", "previewBranch"];
const localStorageBranchKeys = [
  "keystatic-branch",
  "keystatic.branch",
  "keystatic-current-branch",
  "branch",
  "currentBranch",
];

function normalizeBranch(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withoutRef = trimmed.startsWith("refs/heads/")
    ? trimmed.slice("refs/heads/".length)
    : trimmed;

  return withoutRef || null;
}

function branchFromUrl() {
  const url = new URL(window.location.href);

  for (const key of queryBranchKeys) {
    const candidate = normalizeBranch(url.searchParams.get(key));
    if (candidate) return candidate;
  }

  const pathPatterns = [/\/keystatic\/branch\/([^/]+)/i, /\/branch\/([^/]+)/i];
  for (const pattern of pathPatterns) {
    const match = url.pathname.match(pattern);
    const candidate = normalizeBranch(match?.[1] ? decodeURIComponent(match[1]) : "");
    if (candidate) return candidate;
  }

  if (url.hash) {
    const hashValue = url.hash.replace(/^#/, "");
    const hashParams = new URLSearchParams(hashValue);
    for (const key of queryBranchKeys) {
      const candidate = normalizeBranch(hashParams.get(key));
      if (candidate) return candidate;
    }
  }

  return null;
}

function branchFromStorage() {
  for (const key of localStorageBranchKeys) {
    const candidate = normalizeBranch(window.localStorage.getItem(key));
    if (candidate) return candidate;
  }
  return null;
}

function slugifyBranch(branch) {
  return branch
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function previewUrlForBranch(branch) {
  const slug = slugifyBranch(branch);
  return `https://${previewProject}-git-${slug}-${previewTeam}.vercel.app/`;
}

function renderBanner(branch, previewUrl) {
  if (document.getElementById("keystatic-preview-banner")) return;

  const style = document.createElement("style");
  style.textContent = `
    #keystatic-preview-banner {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 9999;
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid #2a3550;
      background: #101726;
      color: #dfe8ff;
      font: 600 13px/1.3 ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.38);
      max-width: min(92vw, 560px);
    }
    #keystatic-preview-banner .ks-preview-link {
      color: #9bd0ff;
      text-decoration: none;
      white-space: nowrap;
      border: 1px solid rgba(155, 208, 255, 0.45);
      padding: 5px 8px;
      border-radius: 8px;
      font-weight: 700;
    }
    #keystatic-preview-banner .ks-preview-link:hover {
      text-decoration: underline;
      background: rgba(155, 208, 255, 0.12);
    }
    #keystatic-preview-banner .ks-preview-branch {
      color: #ffffff;
      font-weight: 800;
      word-break: break-word;
    }
  `;

  const banner = document.createElement("div");
  banner.id = "keystatic-preview-banner";

  const text = document.createElement("span");
  text.append("Previewing branch ");
  const branchValue = document.createElement("span");
  branchValue.className = "ks-preview-branch";
  branchValue.textContent = branch;
  text.append(branchValue);

  const link = document.createElement("a");
  link.className = "ks-preview-link";
  link.href = previewUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "View Preview";

  banner.append(text, link);
  document.head.appendChild(style);
  document.body.appendChild(banner);
}

function initBanner() {
  const branch = branchFromUrl() || normalizeBranch(localGitBranch) || branchFromStorage();
  if (!branch) return;

  const normalized = normalizeBranch(branch);
  if (!normalized) return;

  const previewUrl = previewUrlForBranch(normalized);
  renderBanner(normalized, previewUrl);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initBanner();
  });
} else {
  initBanner();
}
