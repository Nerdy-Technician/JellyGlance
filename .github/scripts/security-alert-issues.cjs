// JellyGlance Security Bot: open one GitHub issue per open security alert.
//
// Sources: code scanning (CodeQL, Trivy, OSV-Scanner, ...) and Dependabot
// alerts. Each issue carries a hidden marker so reruns never duplicate it:
//   <!-- jellyglance-security-alert:<source>:<alert number> -->
// When an alert is fixed or dismissed, its issue is commented on and closed.
// If a fixed alert comes back, the issue is reopened.
//
// Called from .github/workflows/security-alert-issues.yml via github-script.

const MARKER_PREFIX = 'jellyglance-security-alert';
const LABEL = 'security-alert';
const LOGO =
  'https://raw.githubusercontent.com/JellyGlance/Server/main/.github/assets/icon-b-192.png';

const SEVERITY_ORDER = ['low', 'medium', 'high', 'critical'];
const SEVERITY_BADGE = {
  critical: '🟥 **Critical**',
  high: '🟧 **High**',
  medium: '🟨 **Medium**',
  low: '🟩 **Low**',
  error: '🟧 **Error**',
  warning: '🟨 **Warning**',
  note: '🟩 **Note**',
};

function list(value) {
  return String(value || '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

function severityRank(value) {
  const idx = SEVERITY_ORDER.indexOf(String(value || '').toLowerCase());
  if (idx >= 0) return idx;
  // CodeQL non-security rules use error / warning / note.
  return { error: 2, warning: 1, note: 0 }[String(value || '').toLowerCase()] ?? 0;
}

function oneLine(value, max = 120) {
  const s = String(value || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).trim()}…` : s;
}

function markerFor(source, number) {
  return `<!-- ${MARKER_PREFIX}:${source}:${number} -->`;
}

function parseMarker(body) {
  const m = String(body || '').match(
    new RegExp(`<!-- ${MARKER_PREFIX}:(code-scanning|dependabot):(\\d+) -->`),
  );
  return m ? `${m[1]}:${m[2]}` : null;
}

function normaliseCodeScanning(alert, repoUrl) {
  const tool = alert.tool?.name || 'Code scanning';
  const severity =
    alert.rule?.security_severity_level || alert.rule?.severity || 'unknown';
  const loc = alert.most_recent_instance?.location || {};
  const path = loc.path || '';
  const line = loc.start_line ? `#L${loc.start_line}` : '';
  const ref = (alert.most_recent_instance?.ref || 'refs/heads/main').replace('refs/heads/', '');
  const where = path ? `${path}${loc.start_line ? `:${loc.start_line}` : ''}` : '';
  const ruleName = alert.rule?.description || alert.rule?.name || alert.rule?.id || 'Alert';
  return {
    key: `code-scanning:${alert.number}`,
    source: 'code-scanning',
    number: alert.number,
    tool,
    severity: String(severity).toLowerCase(),
    title: `🛡️ ${tool}: ${oneLine(ruleName, 90)}${path ? ` in ${oneLine(path, 60)}` : ''}`,
    url: alert.html_url,
    updatedAt: alert.updated_at || alert.created_at,
    fields: [
      ['Tool', `\`${tool}\``],
      ['Rule', `\`${alert.rule?.id || 'unknown'}\``],
      ['Severity', SEVERITY_BADGE[String(severity).toLowerCase()] || `\`${severity}\``],
      ['Location', path ? `[\`${where}\`](${repoUrl}/blob/${ref}/${path}${line})` : '_no file_'],
      ['Branch', `\`${ref}\``],
      ['First seen', alert.created_at ? alert.created_at.slice(0, 10) : 'unknown'],
    ],
    detail: oneLine(alert.most_recent_instance?.message?.text || alert.rule?.full_description || '', 600),
    fix: 'Fix the code (or the dependency) and push; the alert closes on the next scan. If it is a false positive, dismiss it in the Security tab with a reason.',
  };
}

function normaliseDependabot(alert) {
  const pkg = alert.dependency?.package || {};
  const adv = alert.security_advisory || {};
  const vuln = alert.security_vulnerability || {};
  const severity = adv.severity || vuln.severity || 'unknown';
  const patched = vuln.first_patched_version?.identifier;
  const ids = (adv.identifiers || []).map((i) => i.value).filter(Boolean);
  return {
    key: `dependabot:${alert.number}`,
    source: 'dependabot',
    number: alert.number,
    tool: 'Dependabot',
    severity: String(severity).toLowerCase(),
    title: `📦 ${pkg.name || 'dependency'}: ${oneLine(adv.summary || 'vulnerable dependency', 100)}`,
    url: alert.html_url,
    updatedAt: alert.updated_at || alert.created_at,
    fields: [
      ['Package', `\`${pkg.name || 'unknown'}\` (${pkg.ecosystem || 'unknown'})`],
      ['Severity', SEVERITY_BADGE[String(severity).toLowerCase()] || `\`${severity}\``],
      ['Vulnerable range', `\`${vuln.vulnerable_version_range || 'unknown'}\``],
      ['Patched version', patched ? `\`${patched}\`` : '_no patch yet_'],
      ['Manifest', `\`${alert.dependency?.manifest_path || 'unknown'}\``],
      ['Advisory', ids.length ? ids.map((i) => `\`${i}\``).join(' · ') : 'n/a'],
    ],
    detail: oneLine(adv.description || '', 600),
    fix: patched
      ? `Upgrade \`${pkg.name}\` to \`${patched}\` or later (Renovate may already have a PR open), or add an \`overrides\` entry for a transitive dependency.`
      : 'No patched version yet. Check the advisory for workarounds, or dismiss the alert with a reason if it does not apply.',
  };
}

function issueBody(a) {
  const rows = a.fields.map(([k, v]) => `| **${k}** | ${v} |`).join('\n');
  return [
    markerFor(a.source, a.number),
    `<img src="${LOGO}" alt="JellyGlance" width="48" align="right">`,
    '',
    `## 🚨 Security alert · ${a.tool} #${a.number}`,
    '',
    `> **JellyGlance Security Bot** found an open alert on this repository.`,
    '',
    '| | |',
    '| --- | --- |',
    rows,
    '',
    a.detail ? `### What was found\n\n${a.detail}\n` : '',
    '### What to do',
    '',
    a.fix,
    '',
    `🔗 **[Open the alert](${a.url})** · [Security overview](https://github.com/JellyGlance/Server/security)`,
    '',
    '---',
    '<sub>🪼 JellyGlance Security Bot · this issue is updated automatically and closes itself when the alert is fixed or dismissed.</sub>',
  ]
    .filter((line) => line !== null)
    .join('\n');
}

async function paginate(client, route, params) {
  return client.paginate(route, { per_page: 100, ...params });
}

async function loadAlerts({ readers, owner, repo, core }) {
  const repoUrl = `https://github.com/${owner}/${repo}`;
  const out = { alerts: [], sources: { 'code-scanning': false, dependabot: false } };

  const tryReaders = async (label, fn) => {
    for (const [name, client] of readers) {
      try {
        const res = await fn(client);
        core.info(`${label}: read with ${name}`);
        return res;
      } catch (error) {
        core.info(`${label}: ${name} could not read alerts (${error.status || ''} ${error.message})`);
      }
    }
    return null;
  };

  const code = await tryReaders('Code scanning', (client) =>
    paginate(client, 'GET /repos/{owner}/{repo}/code-scanning/alerts', { owner, repo, state: 'open' }),
  );
  if (code) {
    out.sources['code-scanning'] = true;
    out.alerts.push(...code.map((a) => normaliseCodeScanning(a, repoUrl)));
  } else {
    core.warning('Could not read code scanning alerts. The token needs security-events: read.');
  }

  const dep = await tryReaders('Dependabot', (client) =>
    paginate(client, 'GET /repos/{owner}/{repo}/dependabot/alerts', { owner, repo, state: 'open' }),
  );
  if (dep) {
    out.sources.dependabot = true;
    out.alerts.push(...dep.map(normaliseDependabot));
  } else {
    core.warning(
      'Could not read Dependabot alerts. Give the JellyGlance Security Bot app "Dependabot alerts: read", or make sure Dependabot alerts are enabled.',
    );
  }
  return out;
}

async function fetchAlertState({ readers, owner, repo, source, number }) {
  const route =
    source === 'dependabot'
      ? 'GET /repos/{owner}/{repo}/dependabot/alerts/{alert_number}'
      : 'GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}';
  for (const [, client] of readers) {
    try {
      const { data } = await client.request(route, { owner, repo, alert_number: number });
      return data;
    } catch (error) {
      if (error.status === 404) return { state: 'missing' };
    }
  }
  return null;
}

module.exports = async ({ github, readers, context, core }) => {
  const { owner, repo } = context.repo;
  const assignee = process.env.ASSIGNEE || 'Nerdy-Technician';
  const ignoredTools = list(process.env.IGNORED_TOOLS);
  const minSeverity = String(process.env.MIN_SEVERITY || 'low').toLowerCase();
  const maxNew = Number(process.env.MAX_NEW_ISSUES || '15') || 15;
  const dryRun = String(process.env.DRY_RUN || '') === 'true';

  // Labels (ignore "already exists").
  for (const label of [
    { name: 'security', color: 'b60205', description: 'Security-related paths' },
    { name: LABEL, color: 'c90000', description: 'Opened automatically for an open security alert' },
  ]) {
    try {
      if (!dryRun) await github.rest.issues.createLabel({ owner, repo, ...label });
    } catch (error) {
      if (error.status !== 422) throw error;
    }
  }

  const { alerts, sources } = await loadAlerts({ readers, owner, repo, core });
  const wanted = alerts.filter(
    (a) => !ignoredTools.includes(a.tool.toLowerCase()) && severityRank(a.severity) >= severityRank(minSeverity),
  );
  core.info(`Open alerts: ${alerts.length}; tracked after filters: ${wanted.length}`);

  // Existing tracking issues (open and closed) keyed by marker.
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    owner,
    repo,
    labels: LABEL,
    state: 'all',
    per_page: 100,
  });
  const byKey = new Map();
  for (const issue of issues) {
    if (issue.pull_request) continue;
    const key = parseMarker(issue.body);
    if (!key) continue;
    // Prefer an open issue if there are several for one alert.
    if (!byKey.has(key) || issue.state === 'open') byKey.set(key, issue);
  }

  const summary = { opened: [], updated: [], reopened: [], closed: [] };
  let created = 0;

  for (const alert of wanted) {
    const existing = byKey.get(alert.key);
    const body = issueBody(alert);
    if (!existing) {
      if (created >= maxNew) {
        core.warning(`Reached MAX_NEW_ISSUES=${maxNew}; ${alert.key} will be opened on the next run.`);
        continue;
      }
      created += 1;
      if (dryRun) {
        core.info(`[dry run] would open: ${alert.title}`);
        continue;
      }
      const { data } = await github.rest.issues.create({
        owner,
        repo,
        title: alert.title,
        body,
        labels: ['security', LABEL],
        assignees: [assignee],
      });
      summary.opened.push(`#${data.number} ${alert.title}`);
      continue;
    }

    if (existing.state === 'closed') {
      const closedAt = existing.closed_at ? Date.parse(existing.closed_at) : 0;
      const changed = alert.updatedAt ? Date.parse(alert.updatedAt) : 0;
      if (changed > closedAt) {
        if (!dryRun) {
          await github.rest.issues.update({ owner, repo, issue_number: existing.number, state: 'open', body });
          await github.rest.issues.createComment({
            owner,
            repo,
            issue_number: existing.number,
            body: `🔁 **Alert is open again.** [${alert.tool} #${alert.number}](${alert.url}) is still open or reappeared, so I've reopened this issue.\n\n<sub>🪼 JellyGlance Security Bot</sub>`,
          });
        }
        summary.reopened.push(`#${existing.number}`);
      }
      continue;
    }

    if ((existing.body || '').trim() !== body.trim() || existing.title !== alert.title) {
      if (!dryRun) {
        await github.rest.issues.update({ owner, repo, issue_number: existing.number, title: alert.title, body });
      }
      summary.updated.push(`#${existing.number}`);
    }
  }

  // Close open tracking issues whose alert is no longer open.
  const openKeys = new Set(alerts.map((a) => a.key));
  for (const [key, issue] of byKey) {
    if (issue.state !== 'open' || openKeys.has(key)) continue;
    const [source, num] = key.split(':');
    if (!sources[source]) continue; // could not read this source this run
    const state = await fetchAlertState({ readers, owner, repo, source, number: Number(num) });
    if (!state || state.state === 'open') continue;
    const dismissed = ['dismissed', 'auto_dismissed'].includes(state.state);
    const reason = state.dismissed_reason ? ` (${state.dismissed_reason})` : '';
    const text = {
      fixed: '✅ **Fixed.** The alert is no longer present, so I am closing this issue.',
      dismissed: `🙈 **Dismissed**${reason}. Closing this issue.`,
      auto_dismissed: `🙈 **Auto-dismissed**${reason}. Closing this issue.`,
      missing: '🧹 The alert no longer exists. Closing this issue.',
    }[state.state] || `ℹ️ Alert state is now \`${state.state}\`. Closing this issue.`;
    if (!dryRun) {
      await github.rest.issues.createComment({
        owner,
        repo,
        issue_number: issue.number,
        body: `${text}\n\n<sub>🪼 JellyGlance Security Bot</sub>`,
      });
      await github.rest.issues.update({
        owner,
        repo,
        issue_number: issue.number,
        state: 'closed',
        state_reason: dismissed ? 'not_planned' : 'completed',
      });
    }
    summary.closed.push(`#${issue.number}`);
  }

  const lines = [
    '## 🛡️ JellyGlance Security Bot · alert issues',
    '',
    `- Open alerts seen: **${alerts.length}** (tracked: **${wanted.length}**)`,
    `- Opened: ${summary.opened.length ? summary.opened.join(', ') : 'none'}`,
    `- Updated: ${summary.updated.length ? summary.updated.join(', ') : 'none'}`,
    `- Reopened: ${summary.reopened.length ? summary.reopened.join(', ') : 'none'}`,
    `- Closed: ${summary.closed.length ? summary.closed.join(', ') : 'none'}`,
    ignoredTools.length ? `- Ignored tools: ${ignoredTools.join(', ')}` : '',
    dryRun ? '- **Dry run**: nothing was written.' : '',
  ].filter((line, i) => i < 2 || line);
  await core.summary.addRaw(lines.join('\n')).write();
};
