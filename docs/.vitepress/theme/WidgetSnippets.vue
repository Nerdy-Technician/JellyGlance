<script setup>
import { computed, ref } from "vue";
import { DEFAULT_WIDGET_HOST, TOKEN_API_ENDPOINTS, WIDGET_GROUPS, widgetExportFiles } from "./widgetSnippets.mjs";
import { fileIcon, groupIcon, iconPaths, pathIcon } from "./widgetKitIcons.mjs";

const host = ref(DEFAULT_WIDGET_HOST);
const copied = ref("");
const group = ref("All");
const query = ref("");
const files = computed(() => widgetExportFiles(host.value));
const groups = ["All", ...WIDGET_GROUPS, "Kit"];

const visible = computed(() => {
  const byGroup = group.value === "All" ? files.value : files.value.filter((file) => file.group === group.value);
  const needle = query.value.trim().toLowerCase();
  if (!needle) return byGroup;
  return byGroup.filter((file) =>
    [file.title, file.filename, file.detail, file.kind, file.group].join(" ").toLowerCase().includes(needle)
  );
});

const grouped = computed(() => {
  const order = [];
  const buckets = new Map();
  for (const file of visible.value) {
    if (!buckets.has(file.group)) {
      buckets.set(file.group, []);
      order.push(file.group);
    }
    buckets.get(file.group).push(file);
  }
  return order.map((name) => ({ name, items: buckets.get(name) }));
});

function download(file) {
  const blob = new Blob([file.body], { type: file.mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function copy(file) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(file.body);
    } else {
      const area = document.createElement("textarea");
      area.value = file.body;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    copied.value = file.id;
    window.setTimeout(() => {
      if (copied.value === file.id) copied.value = "";
    }, 1600);
  } catch {
    copied.value = "";
  }
}
</script>

<template>
  <section class="widget-kit" aria-label="Widget downloads">
    <div class="widget-kit-toolbar">
      <label class="widget-kit-host">
        <span>Glance URL</span>
        <input v-model="host" type="url" spellcheck="false" placeholder="http://jellyglance:3000" />
      </label>
      <label class="widget-kit-host widget-kit-search">
        <span>Filter</span>
        <span class="widget-kit-search-field">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path v-for="d in iconPaths('search')" :key="d" :d="d" /></svg>
          <input v-model="query" type="search" spellcheck="false" placeholder="Filter" />
        </span>
      </label>
    </div>
    <p>Homarr JSON and Homepage YAML. Exports never include the API key. After import, set header <code>x-api-token</code> from Settings → API Key. New keys can be widgets-only.</p>
    <div class="widget-kit-groups" role="tablist" aria-label="Widget groups">
      <button
        v-for="name in groups"
        :key="name"
        type="button"
        :class="{ 'is-active': group === name }"
        @click="group = name"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path v-for="d in iconPaths(groupIcon(name))" :key="d" :d="d" /></svg>
        {{ name }}
      </button>
    </div>
    <div v-if="grouped.length" class="widget-kit-list">
      <section v-for="section in grouped" :key="section.name" class="widget-kit-section">
        <h3>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path v-for="d in iconPaths(groupIcon(section.name))" :key="d" :d="d" /></svg>
          {{ section.name }}
          <em>{{ section.items.length }}</em>
        </h3>
        <div class="widget-kit-rows">
          <article v-for="file in section.items" :key="file.id" class="widget-kit-row" :title="file.detail">
            <span class="widget-kit-row-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path v-for="d in iconPaths(fileIcon(file.id))" :key="d" :d="d" /></svg>
            </span>
            <div class="widget-kit-row-main">
              <strong>{{ file.title }}</strong>
              <p>
                <code>{{ file.filename }}</code>
                <span>{{ file.detail }}</span>
              </p>
            </div>
            <span class="widget-kit-kind">{{ file.kind }}</span>
            <div class="widget-kit-row-actions">
              <button type="button" :title="copied === file.id ? 'Copied' : 'Copy'" @click="copy(file)">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path v-for="d in iconPaths(copied === file.id ? 'check' : 'clipboard')" :key="d" :d="d" />
                </svg>
              </button>
              <button type="button" title="Download" @click="download(file)">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path v-for="d in iconPaths('download')" :key="d" :d="d" /></svg>
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>
    <p v-else class="widget-kit-empty">No widgets match that filter.</p>
    <ul class="widget-kit-endpoints">
      <li v-for="item in TOKEN_API_ENDPOINTS" :key="item.path">
        <span class="widget-kit-row-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path v-for="d in iconPaths(pathIcon(item.path))" :key="d" :d="d" /></svg>
        </span>
        <div>
          <code>{{ item.path }}</code>
          <span>{{ item.summary }}</span>
        </div>
      </li>
    </ul>
  </section>
</template>
