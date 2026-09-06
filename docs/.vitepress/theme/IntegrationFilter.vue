<script setup>
import { onMounted, ref } from "vue";

const lanes = [
  { id: "all", label: "All" },
  { id: "media", label: "Media" },
  { id: "seerr", label: "Seerr" },
  { id: "arr", label: "Arr" },
  { id: "downloads", label: "Downloads" },
  { id: "alerts", label: "Alerts" }
];

const active = ref("all");

function apply(id) {
  active.value = id;
  for (const el of document.querySelectorAll(".vp-doc [data-lane]")) {
    const values = String(el.dataset.lane || "").split(/\s+/).filter(Boolean);
    el.hidden = id !== "all" && !values.includes(id);
  }
}

onMounted(() => apply("all"));
</script>

<template>
  <div class="integration-filter" role="group" aria-label="Integration filters">
    <button
      v-for="lane in lanes"
      :key="lane.id"
      type="button"
      :aria-pressed="active === lane.id"
      :class="{ 'is-active': active === lane.id }"
      @click="apply(lane.id)"
    >
      {{ lane.label }}
    </button>
  </div>
</template>
