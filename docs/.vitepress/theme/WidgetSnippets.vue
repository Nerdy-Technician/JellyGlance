<script setup>
import { computed, ref } from "vue";
import { DEFAULT_WIDGET_HOST, TOKEN_API_ENDPOINTS, WIDGET_GROUPS, widgetExportFiles } from "./widgetSnippets.mjs";

const host = ref(DEFAULT_WIDGET_HOST);
const copied = ref("");
const group = ref("All");
const files = computed(() => widgetExportFiles(host.value));
const groups = ["All", ...WIDGET_GROUPS, "Kit"];
const visible = computed(() => (group.value === "All" ? files.value : files.value.filter((file) => file.group === group.value)));

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
    <label class="widget-kit-host">
      <span>Glance URL Homarr and Homepage should call</span>
      <input v-model="host" type="url" spellcheck="false" placeholder="http://jellyglance:3000" />
    </label>
    <p>Thirty Homarr widgets plus a Homepage YAML pack. Exports never include the API key. After import, set auth to API key header <code>x-api-token</code> and paste a key from Settings → API Key.</p>
    <div class="widget-kit-groups">
      <button
        v-for="name in groups"
        :key="name"
        type="button"
        :class="{ 'is-active': group === name }"
        @click="group = name"
      >
        {{ name }}
      </button>
    </div>
    <div class="widget-kit-grid">
      <article v-for="file in visible" :key="file.id" :class="['widget-kit-card', `is-${file.tone}`, { 'is-wide': file.wide }]">
        <div class="widget-kit-card-top">
          <span>{{ file.kicker }}</span>
          <em>{{ file.kind }}</em>
        </div>
        <strong>{{ file.title }}</strong>
        <p>{{ file.detail }}</p>
        <code>{{ file.filename }}</code>
        <div class="widget-kit-card-actions">
          <button type="button" @click="copy(file)">{{ copied === file.id ? "Copied" : "Copy" }}</button>
          <button type="button" class="is-primary" @click="download(file)">Download</button>
        </div>
      </article>
    </div>
    <ul class="widget-kit-endpoints">
      <li v-for="item in TOKEN_API_ENDPOINTS" :key="item.path">
        <code>{{ item.path }}</code>
        <span>{{ item.summary }}</span>
      </li>
    </ul>
  </section>
</template>
