<script setup>
import { useData } from "vitepress";

const { theme } = useData();
</script>

<template>
  <div class="release-cta">
    <div>
      <span>Current release</span>
      <strong>JellyGlance {{ theme.currentVersion }}</strong>
    </div>
    <a :href="theme.latestReleaseUrl" target="_blank" rel="noreferrer">Open Latest Release</a>
  </div>
</template>
