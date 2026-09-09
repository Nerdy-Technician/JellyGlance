export const DEFAULT_WIDGET_HOST = "http://jellyglance:3000";
export const WIDGET_ICON = "https://jellyglance.com/project-logo.png";

const LOGO = WIDGET_ICON;

export const WIDGET_GROUPS = ["Overview", "Playback", "Library", "Queue", "Calendar", "Integrations", "Ops"];

function jsxClose(body) {
  return `${body}\n</Stack>`;
}

function jsxFrame(title, subtitle, badge, body) {
  return jsxClose(`<Stack gap="sm" p="xs">
  <Group justify="space-between" align="center">
    <Group gap="xs">
      <Avatar src="${LOGO}" size={24} radius="xl" />
      <Stack gap={0}>
        <Text fw={800} size="sm">${title}</Text>
        ${subtitle ? `<Text size="xs" c="dimmed">${subtitle}</Text>` : ""}
      </Stack>
    </Group>
    ${badge || `<Badge variant="light" color="violet">Glance</Badge>`}
  </Group>
  ${body}`);
}

function jsxBadge(colorExpr, labelExpr) {
  return `<Badge variant="light" color={${colorExpr}}>${labelExpr}</Badge>`;
}

function jsxStats(cells) {
  const cols = cells
    .map(
      (cell) =>
        `<Grid.Col span={${cell.span || 6}}><Card withBorder radius="md" p="xs"><Text size="xs" c="${cell.color}">${cell.label}</Text><Text fw={800} size="lg">{data.${cell.field}}</Text></Card></Grid.Col>`
    )
    .join("\n    ");
  return `<Grid gutter="xs">\n    ${cols}\n  </Grid>`;
}

function jsxRows(titleField, metaField) {
  return `<Stack gap="xs">
    {data.items.map((row) =>
      <Card withBorder radius="md" p="xs">
        <Group justify="space-between">
          <Text size="sm">{row.${titleField}}</Text>
          <Text size="xs" c="dimmed">{row.${metaField}}</Text>
        </Group>
      </Card>
    )}
  </Stack>`;
}

function remapClear(field = "digestOk", label = "Digest", extra = "digest") {
  return {
    field,
    label,
    format: "text",
    remap: [
      { value: true, to: "Clear" },
      { any: true, to: "Check Glance" },
    ],
    additionalField: extra ? { field: extra, format: "number", color: "adaptive" } : undefined,
  };
}

function mapNum(field, label, extra, color = "theme") {
  return {
    field,
    label,
    format: "number",
    additionalField: extra ? { field: extra, format: "number", color } : undefined,
  };
}

function mapText(field, label, extra, extraFormat = "number", color = "theme") {
  return {
    field,
    label,
    format: "text",
    additionalField: extra ? { field: extra, format: extraFormat, color } : undefined,
  };
}

const HOMARR_OVERVIEW_JSX = jsxFrame(
  "JellyGlance",
  "{data.storage} · {data.sessionsToday} today · {data.users} users",
  jsxBadge('data.digestOk ? "teal" : "red"', '{data.digestOk ? "Clear" : String(data.digest) + " alerts"}'),
  jsxStats([
    { label: "Sessions", field: "sessionsRecent", color: "violet", span: 4 },
    { label: "Downloads", field: "downloads", color: "blue", span: 4 },
    { label: "Alerts", field: "digest", color: "red", span: 4 },
    { label: "Stalled", field: "stalled", color: "teal", span: 4 },
    { label: "Invites", field: "invites", color: "orange", span: 4 },
    { label: "Upcoming", field: "calendarUpcoming", color: "indigo", span: 4 },
  ])
);

export const WIDGET_PACK = [
  {
    id: "overview",
    group: "Overview",
    tone: "purple",
    title: "Overview",
    detail: "Sessions, downloads, alerts, storage, invites, and upcoming releases.",
    filename: "jellyglance-homarr.json",
    path: "/api/widgets/homepage",
    summary: "Dashboard snapshot: sessions, catalog, downloads, digest, storage, invites, calendar",
    name: "JellyGlance overview",
    description: "Sessions, downloads, alerts, storage, invites, and upcoming releases from JellyGlance.",
    jsx: HOMARR_OVERVIEW_JSX,
    homepage: {
      service: "JellyGlance",
      description: "Sessions, downloads, alerts, storage",
      mappings: [
        mapText("storage", "Storage", "sessionsRecent"),
        mapNum("downloads", "Downloads", "stalled", "adaptive"),
        remapClear(),
        mapNum("invites", "Invites", "calendarUpcoming"),
        mapNum("users", "Users", "viewersToday"),
        mapNum("movies", "Movies", "addedWeek"),
      ],
    },
  },
  {
    id: "catalog",
    group: "Overview",
    tone: "violet",
    title: "Catalog",
    detail: "Movies, shows, episodes, libraries, and titles added this week.",
    filename: "jellyglance-homarr-catalog.json",
    path: "/api/widgets/catalog",
    summary: "Movies, shows, episodes, and items added this week",
    name: "JellyGlance catalog",
    description: "Library catalog totals from JellyGlance.",
    jsx: jsxFrame("Catalog", "{data.libraries} libraries", "", jsxStats([
      { label: "Movies", field: "movies", color: "violet" },
      { label: "Shows", field: "shows", color: "blue" },
      { label: "Episodes", field: "episodes", color: "teal" },
      { label: "This week", field: "addedWeek", color: "orange" },
    ])),
    homepage: {
      service: "JellyGlance Catalog",
      description: "Movies, shows, and new titles",
      mappings: [mapNum("movies", "Movies", "shows"), mapNum("episodes", "Episodes", "addedWeek"), mapNum("libraries", "Libraries")],
    },
  },
  {
    id: "storage",
    group: "Overview",
    tone: "teal",
    title: "Storage",
    detail: "Synced library size plus an upcoming Arr estimate.",
    filename: "jellyglance-homarr-storage.json",
    path: "/api/widgets/storage",
    summary: "Library storage total and upcoming Arr estimate",
    name: "JellyGlance storage",
    description: "Library storage and upcoming disk estimate.",
    jsx: jsxFrame("Storage", "{data.upcomingEstimate} incoming", "", jsxStats([
      { label: "Used", field: "totalLabel", color: "teal", span: 12 },
      { label: "Upcoming", field: "upcomingCount", color: "orange" },
      { label: "Estimate", field: "upcomingEstimate", color: "blue" },
    ])),
    homepage: {
      service: "JellyGlance Storage",
      description: "Library size and incoming estimate",
      mappings: [mapText("totalLabel", "Used", "upcomingCount"), mapText("upcomingEstimate", "Incoming")],
    },
  },
  {
    id: "sessions",
    group: "Playback",
    tone: "purple",
    title: "Sessions",
    detail: "Recent, today, last 24 hours, and distinct viewers.",
    filename: "jellyglance-homarr-sessions.json",
    path: "/api/widgets/sessions",
    summary: "Recent, today, and 24h playback counts",
    name: "JellyGlance sessions",
    description: "Recent and daily playback counts.",
    jsx: jsxFrame("Sessions", "{data.users} users", "", jsxStats([
      { label: "Recent", field: "recent", color: "violet" },
      { label: "Today", field: "today", color: "blue" },
      { label: "24h", field: "last24h", color: "teal" },
      { label: "Viewers", field: "viewersToday", color: "orange" },
    ])),
    homepage: {
      service: "JellyGlance Sessions",
      description: "Recent and daily playback",
      mappings: [mapNum("recent", "Recent", "today"), mapNum("last24h", "24h", "viewersToday")],
    },
  },
  {
    id: "viewers",
    group: "Playback",
    tone: "orange",
    title: "Viewers",
    detail: "Distinct people who played something today.",
    filename: "jellyglance-homarr-viewers.json",
    path: "/api/widgets/viewers",
    summary: "Distinct viewers today and synced user count",
    name: "JellyGlance viewers",
    description: "Who watched today versus the full user roster.",
    jsx: jsxFrame("Viewers", "{data.today} plays today", "", jsxStats([
      { label: "Today", field: "viewersToday", color: "orange" },
      { label: "Users", field: "users", color: "violet" },
      { label: "Plays", field: "today", color: "blue", span: 12 },
    ])),
    homepage: {
      service: "JellyGlance Viewers",
      description: "Viewers today and synced users",
      mappings: [mapNum("viewersToday", "Viewers", "users"), mapNum("today", "Plays")],
    },
  },
  {
    id: "users",
    group: "Playback",
    tone: "blue",
    title: "Users",
    detail: "Roster size, admins, and last activity.",
    filename: "jellyglance-homarr-users.json",
    path: "/api/widgets/users",
    summary: "User roster with last activity",
    name: "JellyGlance users",
    description: "Synced Jellyfin users and last activity.",
    jsx: jsxFrame(
      "Users",
      "{data.activeToday} active today",
      "",
      `${jsxStats([
        { label: "Users", field: "users", color: "blue" },
        { label: "Admins", field: "admins", color: "violet" },
      ])}\n  ${jsxRows("name", "lastAt")}`
    ),
    homepage: {
      service: "JellyGlance Users",
      description: "Roster and admins",
      mappings: [mapNum("users", "Users", "admins"), mapNum("activeToday", "Active today")],
    },
  },
  {
    id: "activity",
    group: "Playback",
    tone: "indigo",
    title: "Activity",
    detail: "The latest playback rows: who watched what.",
    filename: "jellyglance-homarr-activity.json",
    path: "/api/widgets/activity",
    summary: "Latest playback rows",
    name: "JellyGlance activity",
    description: "Latest playback titles and viewers.",
    jsx: jsxFrame("Activity", "{data.count} recent", "", jsxRows("title", "viewer")),
    homepage: {
      service: "JellyGlance Activity",
      description: "Latest playback count",
      mappings: [mapNum("count", "Recent plays")],
    },
  },
  {
    id: "watch",
    group: "Playback",
    tone: "green",
    title: "Watch time",
    detail: "Hours watched today, this week, and all time.",
    filename: "jellyglance-homarr-watch.json",
    path: "/api/widgets/watch",
    summary: "Watch-time totals for today, week, and all time",
    name: "JellyGlance watch time",
    description: "Playback hours from JellyGlance history.",
    jsx: jsxFrame("Watch time", "Hours", "", jsxStats([
      { label: "Today", field: "hoursToday", color: "green" },
      { label: "Week", field: "hoursWeek", color: "teal" },
      { label: "All time", field: "hoursAll", color: "violet", span: 12 },
    ])),
    homepage: {
      service: "JellyGlance Watch",
      description: "Hours watched",
      mappings: [mapNum("hoursToday", "Today", "hoursWeek"), mapNum("hoursAll", "All time")],
    },
  },
  {
    id: "libraries",
    group: "Library",
    tone: "teal",
    title: "Libraries",
    detail: "Per-library sizes and item counts.",
    filename: "jellyglance-homarr-libraries.json",
    path: "/api/widgets/libraries",
    summary: "Per-library sizes and catalog totals",
    name: "JellyGlance libraries",
    description: "Per-library sizes from JellyGlance.",
    jsx: jsxFrame(
      "Libraries",
      "{data.totalLabel}",
      `<Badge variant="light" color="violet">{data.totalLabel}</Badge>`,
      `<Table striped>
    <Table.Thead>
      <Table.Tr>
        <Table.Th>Library</Table.Th>
        <Table.Th>Size</Table.Th>
        <Table.Th>Items</Table.Th>
      </Table.Tr>
    </Table.Thead>
    <Table.Tbody>
      {data.libraries.map((row) =>
        <Table.Tr>
          <Table.Td>{row.name}</Table.Td>
          <Table.Td>{row.size}</Table.Td>
          <Table.Td>{row.items}</Table.Td>
        </Table.Tr>
      )}
    </Table.Tbody>
  </Table>`
    ),
    homepage: {
      service: "JellyGlance Libraries",
      description: "Library sizes",
      mappings: [mapText("totalLabel", "Used", "upcomingCount"), mapText("upcomingEstimate", "Incoming")],
    },
  },
  {
    id: "recent",
    group: "Library",
    tone: "blue",
    title: "Recently added",
    detail: "Newest titles synced from Jellyfin.",
    filename: "jellyglance-homarr-recent.json",
    path: "/api/widgets/recent",
    summary: "Recently added library titles",
    name: "JellyGlance recently added",
    description: "Newest library titles from JellyGlance.",
    jsx: jsxFrame("Recently added", "{data.count} titles", "", jsxRows("title", "type")),
    homepage: {
      service: "JellyGlance Recent",
      description: "Newest titles",
      mappings: [mapNum("count", "New titles")],
    },
  },
  {
    id: "item",
    group: "Library",
    tone: "purple",
    title: "Item glance",
    detail: "One Jellyfin title. Replace ITEM_ID after import.",
    filename: "jellyglance-homarr-item.json",
    path: "/api/item-glance/ITEM_ID",
    summary: "One title across Jellyfin, Seerr, Arr, and downloads",
    name: "JellyGlance item",
    description: "One title across Jellyfin, Seerr, Arr, and downloads. Replace ITEM_ID.",
    jsx: jsxFrame(
      "Item glance",
      "{data.item.library}",
      `<Badge variant="light" color="violet">{data.item.type}</Badge>`,
      `<Card withBorder radius="md" p="sm">
    <Text fw={800}>{data.item.name}</Text>
    <Text size="xs" c="dimmed">{data.item.year}</Text>
  </Card>`
    ),
    homepage: {
      service: "JellyGlance Item",
      description: "Replace ITEM_ID with a Jellyfin id",
      mappings: [mapText("jellyglance", "Ready")],
    },
  },
  {
    id: "downloads",
    group: "Queue",
    tone: "blue",
    title: "Downloads",
    detail: "Active and stalled queue counts.",
    filename: "jellyglance-homarr-downloads.json",
    path: "/api/widgets/downloads",
    summary: "Queue counts plus a compact item list",
    name: "JellyGlance downloads",
    description: "Active and stalled queue counts.",
    jsx: jsxFrame(
      "Downloads",
      "",
      jsxBadge('data.stalled ? "red" : "teal"', '{data.stalled ? String(data.stalled) + " stalled" : "Clear"}'),
      jsxStats([
        { label: "Active", field: "active", color: "blue", span: 4 },
        { label: "Stalled", field: "stalled", color: "red", span: 4 },
        { label: "Total", field: "total", color: "dimmed", span: 4 },
      ])
    ),
    homepage: {
      service: "JellyGlance Downloads",
      description: "Active and stalled queue",
      mappings: [mapNum("active", "Active", "stalled", "adaptive"), mapNum("total", "Total")],
    },
  },
  {
    id: "stalled",
    group: "Queue",
    tone: "red",
    title: "Stalled",
    detail: "Failed, errored, or stalled download items.",
    filename: "jellyglance-homarr-stalled.json",
    path: "/api/widgets/stalled",
    summary: "Stalled or failed download items",
    name: "JellyGlance stalled",
    description: "Downloads that need attention.",
    jsx: jsxFrame(
      "Stalled",
      "",
      jsxBadge('data.stalled ? "red" : "teal"', '{data.stalled ? String(data.stalled) + " stuck" : "Clear"}'),
      jsxRows("name", "state")
    ),
    homepage: {
      service: "JellyGlance Stalled",
      description: "Stuck downloads",
      mappings: [mapNum("stalled", "Stalled")],
    },
  },
  {
    id: "queue",
    group: "Queue",
    tone: "indigo",
    title: "Queue list",
    detail: "Compact names and progress from the cached queue.",
    filename: "jellyglance-homarr-queue.json",
    path: "/api/widgets/downloads",
    summary: "Queue counts plus a compact item list",
    name: "JellyGlance queue",
    description: "Download names and progress.",
    jsx: jsxFrame("Queue", "{data.active} active", "", jsxRows("name", "progress")),
    homepage: {
      service: "JellyGlance Queue",
      description: "Queue progress list",
      mappings: [mapNum("active", "Active", "total")],
    },
  },
  {
    id: "stitched",
    group: "Queue",
    tone: "teal",
    title: "Stitched queue",
    detail: "Cached downloads with client names. No live Seerr call.",
    filename: "jellyglance-homarr-stitched.json",
    path: "/api/widgets/stitched",
    summary: "Cached download queue without a live Seerr call",
    name: "JellyGlance stitched queue",
    description: "Cached download queue with client names.",
    jsx: jsxFrame("Stitched queue", "{data.total} items", "", jsxRows("name", "client")),
    homepage: {
      service: "JellyGlance Stitched",
      description: "Cached queue with clients",
      mappings: [mapNum("active", "Active", "stalled", "adaptive"), mapNum("total", "Total")],
    },
  },
  {
    id: "calendar",
    group: "Calendar",
    tone: "blue",
    title: "Calendar",
    detail: "Upcoming Arr releases without a file.",
    filename: "jellyglance-homarr-calendar.json",
    path: "/api/widgets/calendar",
    summary: "Arr releases today and upcoming",
    name: "JellyGlance calendar",
    description: "Upcoming Sonarr, Radarr, and Lidarr dates.",
    jsx: jsxFrame(
      "Calendar",
      "{data.estimate} incoming",
      "",
      `${jsxStats([
        { label: "Upcoming", field: "upcoming", color: "blue" },
        { label: "Today", field: "today", color: "orange" },
      ])}\n  ${jsxRows("title", "service")}`
    ),
    homepage: {
      service: "JellyGlance Calendar",
      description: "Upcoming Arr releases",
      mappings: [mapNum("upcoming", "Upcoming", "today"), mapText("estimate", "Estimate")],
    },
  },
  {
    id: "today",
    group: "Calendar",
    tone: "orange",
    title: "Releases today",
    detail: "Arr titles due today that still need a file.",
    filename: "jellyglance-homarr-today.json",
    path: "/api/widgets/today",
    summary: "Arr releases due today",
    name: "JellyGlance today",
    description: "Arr releases due today.",
    jsx: jsxFrame("Today", "{data.today} releases", "", jsxRows("title", "service")),
    homepage: {
      service: "JellyGlance Today",
      description: "Releases due today",
      mappings: [mapNum("today", "Today")],
    },
  },
  {
    id: "requests",
    group: "Calendar",
    tone: "purple",
    title: "Requests",
    detail: "Live Seerr pending, approved, and available counts.",
    filename: "jellyglance-homarr-requests.json",
    path: "/api/widgets/requests",
    summary: "Seerr request counts by status",
    name: "JellyGlance requests",
    description: "Jellyseerr and Overseerr request counts.",
    jsx: jsxFrame(
      "Requests",
      "{data.total} total",
      "",
      `${jsxStats([
        { label: "Pending", field: "pending", color: "orange" },
        { label: "Approved", field: "approved", color: "blue" },
        { label: "Available", field: "available", color: "teal" },
        { label: "Other", field: "other", color: "dimmed" },
      ])}\n  ${jsxRows("title", "status")}`
    ),
    homepage: {
      service: "JellyGlance Requests",
      description: "Seerr request counts",
      mappings: [mapNum("pending", "Pending", "approved"), mapNum("available", "Available", "total")],
    },
  },
  {
    id: "invites",
    group: "Calendar",
    tone: "orange",
    title: "Invites",
    detail: "Cached Wizarr invite links and status.",
    filename: "jellyglance-homarr-invites.json",
    path: "/api/widgets/invites",
    summary: "Cached Wizarr invite links",
    name: "JellyGlance invites",
    description: "Wizarr invite counts from the last sync.",
    jsx: jsxFrame(
      "Invites",
      "{data.active} active",
      "",
      `${jsxStats([
        { label: "Links", field: "invites", color: "orange" },
        { label: "Active", field: "active", color: "teal" },
      ])}\n  ${jsxRows("code", "status")}`
    ),
    homepage: {
      service: "JellyGlance Invites",
      description: "Wizarr invite links",
      mappings: [mapNum("invites", "Links", "active")],
    },
  },
  {
    id: "autobrr",
    group: "Integrations",
    tone: "orange",
    title: "autobrr",
    detail: "Cached autobrr release hits from the last sync.",
    filename: "jellyglance-homarr-autobrr.json",
    path: "/api/widgets/autobrr",
    summary: "Cached autobrr release hits",
    name: "JellyGlance autobrr",
    description: "Recent autobrr hits from JellyGlance.",
    jsx: jsxFrame("autobrr", "{data.autobrr} hits", "", jsxRows("name", "indexer")),
    homepage: {
      service: "JellyGlance autobrr",
      description: "autobrr release hits",
      mappings: [mapNum("autobrr", "Hits")],
    },
  },
  {
    id: "transcodes",
    group: "Integrations",
    tone: "green",
    title: "Transcodes",
    detail: "Tdarr connection and last health check.",
    filename: "jellyglance-homarr-transcodes.json",
    path: "/api/widgets/transcodes",
    summary: "Tdarr connection and last health check",
    name: "JellyGlance transcodes",
    description: "Tdarr reachability from Glance health history.",
    jsx: jsxFrame(
      "Tdarr",
      "{data.name}",
      jsxBadge('data.ok ? "teal" : "red"', '{data.ok ? "Online" : "Down"}'),
      `<Card withBorder radius="md" p="sm">
    <Text size="sm">{data.message}</Text>
  </Card>`
    ),
    homepage: {
      service: "JellyGlance Tdarr",
      description: "Tdarr health",
      mappings: [remapClear("ok", "Tdarr", null), mapText("name", "Name")],
    },
  },
  {
    id: "maintainerr",
    group: "Integrations",
    tone: "red",
    title: "Maintainerr",
    detail: "Maintainerr connection and last health check.",
    filename: "jellyglance-homarr-maintainerr.json",
    path: "/api/widgets/maintainerr",
    summary: "Maintainerr connection and last health check",
    name: "JellyGlance Maintainerr",
    description: "Maintainerr reachability from Glance health history.",
    jsx: jsxFrame(
      "Maintainerr",
      "{data.name}",
      jsxBadge('data.ok ? "teal" : "red"', '{data.ok ? "Online" : "Down"}'),
      `<Card withBorder radius="md" p="sm">
    <Text size="sm">{data.message}</Text>
  </Card>`
    ),
    homepage: {
      service: "JellyGlance Maintainerr",
      description: "Maintainerr health",
      mappings: [remapClear("ok", "Maintainerr", null), mapText("name", "Name")],
    },
  },
  {
    id: "automation",
    group: "Integrations",
    tone: "indigo",
    title: "Automation health",
    detail: "Latest Arr, download, and third-party health results.",
    filename: "jellyglance-homarr-automation.json",
    path: "/api/widgets/automation",
    summary: "Latest integration health results",
    name: "JellyGlance automation",
    description: "Connected integrations and last health results.",
    jsx: jsxFrame(
      "Automation",
      "{data.connected} connected",
      jsxBadge('data.ok ? "teal" : "red"', '{data.ok ? "Clear" : String(data.failing) + " down"}'),
      `${jsxStats([
        { label: "Connected", field: "connected", color: "teal" },
        { label: "Failing", field: "failing", color: "red" },
      ])}\n  ${jsxRows("name", "message")}`
    ),
    homepage: {
      service: "JellyGlance Automation",
      description: "Integration health",
      mappings: [mapNum("connected", "Connected", "failing", "adaptive"), remapClear("ok", "Health", "checked")],
    },
  },
  {
    id: "devices",
    group: "Integrations",
    tone: "blue",
    title: "Devices",
    detail: "Jellyfin clients Glance has seen before.",
    filename: "jellyglance-homarr-devices.json",
    path: "/api/widgets/devices",
    summary: "Known Jellyfin client devices",
    name: "JellyGlance devices",
    description: "Known Jellyfin client devices.",
    jsx: jsxFrame("Devices", "Known clients", "", jsxStats([{ label: "Known", field: "devices", color: "blue", span: 12 }])),
    homepage: {
      service: "JellyGlance Devices",
      description: "Known Jellyfin clients",
      mappings: [mapNum("devices", "Devices")],
    },
  },
  {
    id: "health",
    group: "Ops",
    tone: "green",
    title: "Health",
    detail: "Live Jellyfin ping plus the ops digest.",
    filename: "jellyglance-homarr-health.json",
    path: "/api/widgets/health",
    summary: "Digest, live Jellyfin ping, and backup hint",
    name: "JellyGlance health",
    description: "Glance heartbeat and ops digest status.",
    jsx: jsxFrame(
      "JellyGlance",
      "{data.jellyfinName} {data.jellyfinVersion}",
      jsxBadge('data.jellyglance ? "teal" : "red"', '{data.jellyglance ? "Online" : "Down"}'),
      `<Card withBorder radius="md" p="sm">
    <Group justify="space-between">
      <Text size="sm">Ops digest</Text>
      <Badge variant="light" color={data.digestOk ? "teal" : "orange"}>
        {data.digestOk ? "Clear" : String(data.digest) + " items"}
      </Badge>
    </Group>
  </Card>`
    ),
    homepage: {
      service: "JellyGlance Health",
      description: "Jellyfin and digest",
      mappings: [remapClear("jellyfinOk", "Jellyfin", null), remapClear()],
    },
  },
  {
    id: "digest",
    group: "Ops",
    tone: "red",
    title: "Ops digest",
    detail: "Stalled downloads, failed webhooks, and recent failures.",
    filename: "jellyglance-homarr-digest.json",
    path: "/api/widgets/digest",
    summary: "Ops digest items that need attention",
    name: "JellyGlance digest",
    description: "Ops items that need attention.",
    jsx: jsxFrame(
      "Digest",
      "",
      jsxBadge('data.digestOk ? "teal" : "red"', '{data.digestOk ? "Clear" : String(data.digest) + " items"}'),
      jsxRows("label", "type")
    ),
    homepage: {
      service: "JellyGlance Digest",
      description: "Ops items that need attention",
      mappings: [remapClear()],
    },
  },
  {
    id: "jellyfin",
    group: "Ops",
    tone: "green",
    title: "Jellyfin",
    detail: "Live reachability, server name, and version.",
    filename: "jellyglance-homarr-jellyfin.json",
    path: "/api/jellyfin/status",
    summary: "Live Jellyfin reachability and version",
    name: "JellyGlance Jellyfin",
    description: "Live Jellyfin ping from Glance.",
    jsx: jsxFrame(
      "Jellyfin",
      "{data.version}",
      jsxBadge('data.ok ? "teal" : "red"', '{data.ok ? "Online" : "Down"}'),
      `<Card withBorder radius="md" p="sm">
    <Text fw={800}>{data.name}</Text>
    <Text size="xs" c="dimmed">{data.checkedAt}</Text>
  </Card>`
    ),
    homepage: {
      service: "JellyGlance Jellyfin",
      description: "Live Jellyfin ping",
      mappings: [remapClear("ok", "Jellyfin", null), mapText("name", "Name"), mapText("version", "Version")],
    },
  },
  {
    id: "backup",
    group: "Ops",
    tone: "teal",
    title: "Backup",
    detail: "Last backup hint and destination kind.",
    filename: "jellyglance-homarr-backup.json",
    path: "/api/widgets/backup",
    summary: "Last backup hint and destination kind",
    name: "JellyGlance backup",
    description: "Last backup hint from Glance settings.",
    jsx: jsxFrame(
      "Backup",
      "{data.kind}",
      jsxBadge('data.configured ? "teal" : "orange"', '{data.configured ? "Set" : "Local"}'),
      `<Card withBorder radius="md" p="sm">
    <Text size="sm">{data.backupAt}</Text>
  </Card>`
    ),
    homepage: {
      service: "JellyGlance Backup",
      description: "Last backup hint",
      mappings: [mapText("kind", "Kind"), mapText("backupAt", "Last run")],
    },
  },
  {
    id: "webhooks",
    group: "Ops",
    tone: "orange",
    title: "Webhooks",
    detail: "Recent webhook deliveries and failures.",
    filename: "jellyglance-homarr-webhooks.json",
    path: "/api/widgets/webhooks",
    summary: "Recent webhook deliveries",
    name: "JellyGlance webhooks",
    description: "Recent webhook delivery history.",
    jsx: jsxFrame(
      "Webhooks",
      "{data.total} recent",
      jsxBadge('data.ok ? "teal" : "red"', '{data.ok ? "Clear" : String(data.failed) + " failed"}'),
      jsxRows("name", "at")
    ),
    homepage: {
      service: "JellyGlance Webhooks",
      description: "Webhook deliveries",
      mappings: [mapNum("total", "Recent", "failed", "adaptive"), remapClear("ok", "Deliveries", null)],
    },
  },
  {
    id: "jobs",
    group: "Ops",
    tone: "indigo",
    title: "Jobs",
    detail: "Latest Glance task runs from jf_logging.",
    filename: "jellyglance-homarr-jobs.json",
    path: "/api/widgets/jobs",
    summary: "Latest Glance task runs",
    name: "JellyGlance jobs",
    description: "Latest scheduled Glance task results.",
    jsx: jsxFrame(
      "Jobs",
      "{data.jobs} tasks",
      jsxBadge('data.ok ? "teal" : "red"', '{data.ok ? "Clear" : String(data.failed) + " failed"}'),
      jsxRows("name", "result")
    ),
    homepage: {
      service: "JellyGlance Jobs",
      description: "Task history",
      mappings: [mapNum("jobs", "Tasks", "failed", "adaptive"), remapClear("ok", "Jobs", null)],
    },
  },
];

const EXTRA_ENDPOINTS = [
  { path: "/api/widgets", summary: "Catalog of token-auth widget endpoints" },
  { path: "/api/ops-digest", summary: "Ops items that need attention" },
  { path: "/api/library-storage", summary: "Per-library sizes and upcoming estimate" },
  { path: "/api/downloads/stitched", summary: "Download queue matched to Seerr requests" },
];

export const TOKEN_API_ENDPOINTS = [
  ...EXTRA_ENDPOINTS,
  ...WIDGET_PACK.filter((widget, index, list) => list.findIndex((row) => row.path === widget.path) === index).map((widget) => ({
    path: widget.path.replace("ITEM_ID", ":id"),
    summary: widget.summary,
  })),
];

export function normalizeWidgetHost(host) {
  const raw = String(host || DEFAULT_WIDGET_HOST).trim() || DEFAULT_WIDGET_HOST;
  return raw.replace(/\/+$/, "");
}

export function widgetEndpoint(host, path = "/api/widgets/homepage") {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${normalizeWidgetHost(host)}${suffix}`;
}

export function homarrWidget(host, path, name, description, template) {
  return {
    $schema: "homarr-custom-widget-v2",
    name,
    description,
    iconUrl: WIDGET_ICON,
    url: widgetEndpoint(host, path),
    authType: "apiKeyHeader",
    headerName: "x-api-token",
    method: "GET",
    displayType: "customJsx",
    displayConfig: {
      type: "customJsx",
      template,
    },
  };
}

export function homarrFromPack(host, widget) {
  return homarrWidget(host, widget.path, widget.name, widget.description, widget.jsx);
}

export function homarrSnapshotWidget(host) {
  return homarrFromPack(host, WIDGET_PACK.find((widget) => widget.id === "overview"));
}

export function homarrStatusWidget(host) {
  return homarrFromPack(host, WIDGET_PACK.find((widget) => widget.id === "health"));
}

export function homarrLibrariesWidget(host) {
  return homarrFromPack(host, WIDGET_PACK.find((widget) => widget.id === "libraries"));
}

export function homarrSessionsWidget(host) {
  return homarrFromPack(host, WIDGET_PACK.find((widget) => widget.id === "sessions"));
}

export function homarrDownloadsWidget(host) {
  return homarrFromPack(host, WIDGET_PACK.find((widget) => widget.id === "downloads"));
}

function mappingYaml(mapping) {
  const extra = mapping.additionalField
    ? `
          additionalField:
            field: ${mapping.additionalField.field}
            format: ${mapping.additionalField.format}
            color: ${mapping.additionalField.color}`
    : "";
  const remap = Array.isArray(mapping.remap)
    ? `
          remap:
${mapping.remap
  .map((row) =>
    row.any
      ? `            - any: true
              to: ${row.to}`
      : `            - value: ${row.value}
              to: ${row.to}`
  )
  .join("\n")}`
    : "";
  return `        - field: ${mapping.field}
          label: ${mapping.label}
          format: ${mapping.format}${remap}${extra}`;
}

export function homepageYaml(host) {
  const base = normalizeWidgetHost(host);
  return `${WIDGET_PACK.filter((widget) => widget.id !== "item").map((widget) => {
    const mappings = (widget.homepage?.mappings || []).map(mappingYaml).join("\n");
    return `- ${widget.homepage.service}:
    icon: ${WIDGET_ICON}
    href: ${base}
    description: ${widget.homepage.description}
    widget:
      type: customapi
      url: ${widgetEndpoint(host, widget.path)}
      refreshInterval: 60000
      display: list
      headers:
        x-api-token: YOUR_JELLYGLANCE_API_KEY
      mappings:
${mappings}`;
  }).join("\n\n")}
`;
}

export function widgetCurl(host, key = "YOUR_JELLYGLANCE_API_KEY") {
  return `curl -sS -H "x-api-token: ${key}" ${widgetEndpoint(host, "/api/widgets/homepage")}`;
}

export function prettyJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function downloadTextFile(filename, content, mime = "application/json") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function widgetExportFiles(host, key) {
  const widgets = WIDGET_PACK.map((widget) => ({
    id: widget.id,
    group: widget.group,
    kicker: widget.group,
    tone: widget.tone,
    kind: "JSON",
    title: widget.title,
    detail: widget.detail,
    filename: widget.filename,
    mime: "application/json",
    wide: false,
    body: prettyJson(homarrFromPack(host, widget)),
  }));
  return [
    ...widgets,
    {
      id: "homepage",
      group: "Kit",
      kicker: "Homepage",
      tone: "blue",
      kind: "YAML",
      title: "Homepage YAML",
      detail: "Thirty customapi services. Replace YOUR_JELLYGLANCE_API_KEY with a Settings key.",
      filename: "jellyglance-homepage.yaml",
      mime: "text/yaml",
      wide: true,
      body: homepageYaml(host),
    },
    {
      id: "curl",
      group: "Kit",
      kicker: "CLI",
      tone: "orange",
      kind: "SH",
      title: "curl",
      detail: "Same overview snapshot Homarr and Homepage can poll.",
      filename: "jellyglance-widget.sh",
      mime: "text/plain",
      wide: true,
      body: `${widgetCurl(host, key)}\n`,
    },
  ];
}
