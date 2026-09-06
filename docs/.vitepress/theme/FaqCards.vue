<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";

const groups = [
  { id: "all", label: "All" },
  { id: "install", label: "Install" },
  { id: "connect", label: "Connect" },
  { id: "run", label: "Daily" },
  { id: "help", label: "Help" }
];

const items = [
  { id: "product", group: "run", tone: "brand", kicker: "Product", question: "Does JellyGlance replace Jellyfin?" },
  { id: "install", group: "install", tone: "green", kicker: "Install", question: "What do I need to run it?" },
  { id: "jellyfin", group: "connect", tone: "blue", kicker: "Jellyfin", question: "Jellyfin will not validate the URL or API key", wide: true },
  { id: "auth", group: "connect", tone: "purple", kicker: "Auth", question: "Which login should I pick?", wide: true },
  { id: "sync", group: "run", tone: "yellow", kicker: "Sync", question: "The first sync is stuck or Home looks empty", wide: true },
  { id: "pages", group: "run", tone: "teal", kicker: "Pages", question: "Where are Requests, Downloads, or Invites?" },
  { id: "proxy", group: "connect", tone: "orange", kicker: "Proxy", question: "How do I put it behind a reverse proxy?" },
  { id: "sessions", group: "connect", tone: "red", kicker: "Sessions", question: "I changed JWT_SECRET and everyone is logged out" },
  { id: "reset", group: "install", tone: "gray", kicker: "Reset", question: "How do I reset first-run?" },
  { id: "bootstrap", group: "install", tone: "green", kicker: "Bootstrap", question: "Can I skip the wizard?" },
  { id: "nas", group: "install", tone: "blue", kicker: "NAS", question: "Unraid or TrueNAS?" },
  { id: "widgets", group: "connect", tone: "red", kicker: "Widgets", question: "Homepage or Homarr says 403" },
  { id: "update", group: "install", tone: "green", kicker: "Update", question: "How do I update?" }
];

const authModes = [
  { id: "quick", title: "Quick Connect", blurb: "Household already on Jellyfin. They approve login there and inherit the Glance role from Users." },
  { id: "local", title: "Local admin", blurb: "You want a Glance-only owner account and will add other local users later." },
  { id: "oidc", title: "OIDC", blurb: "An external identity provider is already in the stack. Settings are stored; Glance does not become your IdP." }
];

const filter = ref("all");
const query = ref("");
const openIds = ref([]);
const spotlight = ref("");
const copied = ref("");
const pickedAuth = ref("quick");
const rolling = ref(false);

const visible = computed(() => {
  const needle = query.value.trim().toLowerCase();
  return items.filter((item) => {
    if (filter.value !== "all" && item.group !== filter.value) return false;
    if (!needle) return true;
    return `${item.kicker} ${item.question} ${item.group}`.toLowerCase().includes(needle);
  });
});

const pickedAuthMode = computed(() => authModes.find((mode) => mode.id === pickedAuth.value) || authModes[0]);

function isOpen(id) {
  return openIds.value.includes(id);
}

function setHash(id) {
  if (typeof history === "undefined") return;
  history.replaceState(null, "", id ? `#${id}` : location.pathname);
}

function toggle(id) {
  openIds.value = isOpen(id) ? openIds.value.filter((entry) => entry !== id) : [...openIds.value, id];
  setHash(isOpen(id) ? id : "");
}

function openOnly(id) {
  openIds.value = [id];
  spotlight.value = id;
  setHash(id);
  window.setTimeout(() => {
    if (spotlight.value === id) spotlight.value = "";
  }, 900);
}

async function rollOne() {
  const pool = visible.value.length ? visible.value : items;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  rolling.value = true;
  openOnly(pick.id);
  await nextTick();
  document.getElementById(`faq-${pick.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => {
    rolling.value = false;
  }, 400);
}

async function copyCode(id, text) {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = id;
    window.setTimeout(() => {
      if (copied.value === id) copied.value = "";
    }, 1400);
  } catch {
    copied.value = "";
  }
}

function applyHash() {
  const id = decodeURIComponent(location.hash.replace(/^#/, ""));
  if (items.some((item) => item.id === id)) openOnly(id);
}

onMounted(() => {
  applyHash();
  window.addEventListener("hashchange", applyHash);
});

onUnmounted(() => {
  window.removeEventListener("hashchange", applyHash);
});
</script>

<template>
  <section class="faq-board">
    <div class="faq-toolbar">
      <div class="faq-chips" role="group" aria-label="FAQ filters">
        <button
          v-for="group in groups"
          :key="group.id"
          type="button"
          :aria-pressed="filter === group.id"
          :class="['faq-chip', { 'is-active': filter === group.id }]"
          @click="filter = group.id"
        >
          {{ group.label }}
        </button>
      </div>
      <div class="faq-tools">
        <label class="faq-search">
          <span class="visually-hidden">Search the FAQ</span>
          <input v-model="query" type="search" placeholder="Type stuck, proxy, JWT…">
        </label>
        <button type="button" class="faq-roll" :class="{ 'is-rolling': rolling }" @click="rollOne">
          Roll one
        </button>
      </div>
    </div>

    <p class="faq-hint">
      {{ visible.length }} {{ visible.length === 1 ? "card" : "cards" }}.
      Tap to open. Roll one if you would rather not browse.
    </p>

    <div class="faq-grid">
      <article
        v-for="(item, index) in visible"
        :id="`faq-${item.id}`"
        :key="item.id"
        class="faq-card"
        :class="[
          `is-${item.tone}`,
          { 'is-open': isOpen(item.id), 'is-wide': item.wide && isOpen(item.id), 'is-spotlight': spotlight === item.id }
        ]"
        :style="{ '--faq-delay': `${index * 35}ms` }"
      >
        <button type="button" class="faq-card-toggle" :aria-expanded="isOpen(item.id)" @click="toggle(item.id)">
          <span>{{ item.kicker }}</span>
          <h2>{{ item.question }}</h2>
          <em>{{ isOpen(item.id) ? "Close" : "Open" }}</em>
        </button>

        <div class="faq-answer" :hidden="!isOpen(item.id)">
          <div class="faq-answer-inner">
            <template v-if="item.id === 'product'">
              <p>No. Jellyfin stays the media server. Glance sits beside it and pulls sessions, libraries, users, requests, downloads, jobs, and health into one admin view.</p>
            </template>

            <template v-else-if="item.id === 'install'">
              <p>Docker Compose v2, PostgreSQL 16 (the compose file starts it), and a Jellyfin URL plus API key. Open <code>http://localhost:3000</code> after <code>docker compose up -d</code>.</p>
              <p>Change <code>JWT_SECRET</code>, <code>POSTGRES_PASSWORD</code>, and <code>TZ</code> before you expose the stack off your LAN. See <a href="/guide/getting-started">Getting Started</a> and <a href="/operations/docker">Docker</a>.</p>
            </template>

            <template v-else-if="item.id === 'jellyfin'">
              <p>Glance has to reach Jellyfin <strong>from the container</strong>, not from your browser.</p>
              <ul>
                <li>Use a LAN IP or hostname, not <code>localhost</code>, if Jellyfin runs on the host or another container.</li>
                <li>Match <code>http</code> / <code>https</code> to what Jellyfin actually serves.</li>
                <li>Use a Jellyfin API key with library and user access, not a user password.</li>
                <li>If Jellyfin is on another Docker network, put both stacks on the same network or use the host IP.</li>
              </ul>
              <p>A <code>403</code> from Jellyfin usually means the key is wrong or the user that created it cannot see the libraries.</p>
            </template>

            <template v-else-if="item.id === 'auth'">
              <div class="faq-modes">
                <button
                  v-for="mode in authModes"
                  :key="mode.id"
                  type="button"
                  :class="{ 'is-picked': pickedAuth === mode.id }"
                  @click.stop="pickedAuth = mode.id"
                >
                  <strong>{{ mode.title }}</strong>
                  <p>{{ mode.blurb }}</p>
                </button>
              </div>
              <p class="faq-pick-line">{{ pickedAuthMode.title }} is a solid pick. You can keep Quick Connect users and local accounts on the same install.</p>
            </template>

            <template v-else-if="item.id === 'sync'">
              <p>The wizard only starts the sync. The work runs as <strong>Settings → Tasks</strong>.</p>
              <ul>
                <li>Wait for <strong>Complete Jellyfin Sync</strong>, not only Recently Added.</li>
                <li>Confirm Jellyfin still answers from the Glance container (<code>docker logs jellyglance</code>).</li>
                <li>Artwork and stats fill in after the first full sync, not instantly.</li>
              </ul>
              <p>If the task never starts, check that Postgres is healthy (<code>jellyglance-db</code>) and restart the Glance container. <code>Unable to start first sync</code> means the API could not queue the job — logs are the next stop.</p>
            </template>

            <template v-else-if="item.id === 'pages'">
              <p>Those pages stay hidden until the matching integration is configured. Empty queue screens are intentional.</p>
              <p>Connect the app under <strong>Settings → Integrations</strong>, then look again: Seerr for Requests, a download client for Downloads, Tdarr for Active Transcodes, Wizarr for Invites.</p>
            </template>

            <template v-else-if="item.id === 'proxy'">
              <p>Point the proxy at Glance on port <code>3000</code>. Do not publish Postgres.</p>
              <p>Keep the UI and API on the same origin. Forward <code>Host</code> and <code>X-Forwarded-Proto</code>. LAN origins are already allowed; a public HTTPS name works when the browser talks to that same host.</p>
              <p>Do not put a Glance API key in a public iframe URL. Widget calls should stay server-side on the LAN. See <a href="/operations/widgets">Homepage widgets</a>.</p>
            </template>

            <template v-else-if="item.id === 'sessions'">
              <p>That is expected. <code>JWT_SECRET</code> signs Glance sessions. Changing it invalidates every login. Set it once, keep it stable, and store it with the rest of the compose secrets.</p>
            </template>

            <template v-else-if="item.id === 'reset'">
              <p>Back up first (<strong>Settings → Backup</strong>, or copy <code>./backups</code>). Then wipe the database and start again.</p>
              <p>If you use the repo compose file (Postgres in <code>./postgres-data</code>):</p>
              <div class="faq-code">
                <button type="button" @click.stop="copyCode('reset', 'docker compose down\nrm -rf ./postgres-data\ndocker compose up -d')">
                  {{ copied === "reset" ? "Copied" : "Copy" }}
                </button>
                <pre><code>docker compose down
rm -rf ./postgres-data
docker compose up -d</code></pre>
              </div>
              <p>If you used a named Docker volume instead, remove that volume. This deletes Glance state, not Jellyfin.</p>
            </template>

            <template v-else-if="item.id === 'bootstrap'">
              <p>Yes. The compose file has optional <code>JF_HOST</code>, <code>JF_API_KEY</code>, <code>JS_AUTH_MODE</code>, <code>JS_USER</code>, <code>JS_PASSWORD</code>, <code>JS_SKIP_FIRST_RUN</code>, and <code>JS_AUTO_START_SYNC</code> comments. That seeds the same first-run data the wizard writes.</p>
            </template>

            <template v-else-if="item.id === 'nas'">
              <p>Same image and volumes as Docker Compose. PostgreSQL is a second container on the same network. Notes are on <a href="/operations/catalog">Unraid and TrueNAS</a>.</p>
            </template>

            <template v-else-if="item.id === 'widgets'">
              <p>That token is a <strong>JellyGlance</strong> API key from <strong>Settings → API Key</strong>, sent as <code>x-api-token</code>. It is not the Jellyfin API key from first-run.</p>
            </template>

            <template v-else-if="item.id === 'update'">
              <div class="faq-code">
                <button type="button" @click.stop="copyCode('update', 'docker compose pull\ndocker compose up -d')">
                  {{ copied === "update" ? "Copied" : "Copy" }}
                </button>
                <pre><code>docker compose pull
docker compose up -d</code></pre>
              </div>
              <p>Images are on <code>ghcr.io/nerdy-technician/jellyglance</code> for <code>linux/amd64</code>, <code>linux/arm64</code>, and <code>linux/arm/v7</code>.</p>
              <p><code>docker-compose</code> (v1, with a hyphen) can crash on modern Docker with <code>KeyError: 'id'</code>. Use <code>docker compose</code>.</p>
            </template>
          </div>
        </div>
      </article>
    </div>

    <p v-if="!visible.length && (query.trim() || filter !== 'help')" class="faq-empty">
      That drawer is empty. Clear the search or hop back to All.
    </p>

    <article class="faq-card is-brand is-wide faq-card-cta">
      <span>Help</span>
      <h2>Still stuck?</h2>
      <p>Ask in Discord or open an issue on GitHub. Product direction is on the Roadmap.</p>
      <div class="faq-cta-row">
        <a href="https://discord.gg/dMGhv8j2kx" target="_blank" rel="noreferrer">Discord</a>
        <a href="https://github.com/Nerdy-Technician/JellyGlance" target="_blank" rel="noreferrer">GitHub</a>
        <a href="/roadmap">Roadmap</a>
      </div>
    </article>
  </section>
</template>
