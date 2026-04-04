import { defineMiddleware } from "astro:middleware";
import { execSync } from "node:child_process";

const defaultPreviewProject = "ghostbustersva";
const defaultPreviewTeam = "afton-gauntletts-projects";

const previewProject = import.meta.env.PUBLIC_VERCEL_PROJECT_NAME?.trim() || defaultPreviewProject;
const previewTeam = import.meta.env.PUBLIC_VERCEL_TEAM_SLUG?.trim() || defaultPreviewTeam;

function getLocalGitBranch(): string {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

const localGitBranch = getLocalGitBranch();

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export const onRequest = defineMiddleware(async ({ request }, next) => {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/keystatic")) {
    return next();
  }

  const response = await next();
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) {
    return response;
  }

  const html = await response.text();
  if (html.includes("/keystatic-preview-banner.js")) {
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  const scriptTag = `<script id="keystatic-preview-banner-loader" type="module" src="/keystatic-preview-banner.js" data-preview-project="${escapeHtmlAttr(
    previewProject,
  )}" data-preview-team="${escapeHtmlAttr(previewTeam)}" data-local-branch="${escapeHtmlAttr(
    localGitBranch,
  )}"></script>`;

  const injectedHtml = html.includes("</body>")
    ? html.replace("</body>", `${scriptTag}</body>`)
    : `${html}${scriptTag}`;

  const headers = new Headers(response.headers);
  headers.delete("content-length");

  return new Response(injectedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});
