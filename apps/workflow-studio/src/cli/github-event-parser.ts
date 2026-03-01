export function parseGitHubEvent(
  eventType: string | null,
  payload: Record<string, unknown>,
): Record<string, string> | null {
  if (!eventType) return null;

  const vars: Record<string, string> = { github_event: eventType };

  if (eventType === 'push') {
    const repo = payload.repository as { full_name?: string } | undefined;
    const head = payload.head_commit as { id?: string } | undefined;
    if (typeof payload.ref === 'string') vars.github_ref = payload.ref;
    if (repo?.full_name) vars.github_repo = repo.full_name;
    if (head?.id) vars.github_sha = head.id;
  } else if (eventType === 'pull_request') {
    const pr = payload.pull_request as {
      head?: { ref?: string; sha?: string };
      base?: { ref?: string };
    } | undefined;
    if (typeof payload.number === 'number') vars.github_pr_number = String(payload.number);
    if (pr?.head?.ref) vars.github_pr_head = pr.head.ref;
    if (pr?.head?.sha) vars.github_pr_head_sha = pr.head.sha;
    if (pr?.base?.ref) vars.github_pr_base = pr.base.ref;
    if (typeof payload.action === 'string') vars.github_pr_action = payload.action;
  }

  return vars;
}
