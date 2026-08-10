<script setup>
import { computed } from "vue";
import { useData } from "vitepress";

const { theme } = useData();

const release = computed(() => theme.value.latestRelease || {});
const sections = computed(() => release.value.sections || []);
const publishedDate = computed(() => {
  if (!release.value.publishedAt) return "Latest build";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(release.value.publishedAt));
});
</script>

<template>
  <section class="latest-release-notes">
    <div class="latest-release-header">
      <div>
        <span>Newest release</span>
        <h2>{{ release.name || `JellyGlance ${release.version}` }}</h2>
        <p>{{ publishedDate }}</p>
      </div>
      <a :href="release.url" target="_blank" rel="noreferrer">Open on GitHub</a>
    </div>

    <div v-if="sections.length" class="latest-release-section-grid">
      <article v-for="section in sections" :key="section.title">
        <h3>{{ section.title }}</h3>
        <ul>
          <li v-for="item in section.items" :key="item">{{ item }}</li>
        </ul>
      </article>
    </div>

    <p v-else class="latest-release-empty">Release notes will appear here after the next GitHub release is published.</p>
  </section>
</template>
