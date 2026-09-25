<script setup>
import { computed } from "vue";
import { useData } from "vitepress";

const { theme } = useData();

const roadmap = computed(() => theme.value.roadmap || {});
const columns = computed(() => roadmap.value.columns || []);
const shipped = computed(() => roadmap.value.shipped || []);
const boardUrl = computed(() => roadmap.value.url || "https://github.com/users/Nerdy-Technician/projects/5");
const fetched = computed(() => roadmap.value.fetched === true);

function itemKey(item, index) {
  return item.url && item.number != null ? `${item.url}#${item.number}` : `${item.title}-${index}`;
}

function columnTone(column) {
  const fromApi = String(column.color || "").toLowerCase();
  if (fromApi) return fromApi;

  const name = String(column.name || "").toLowerCase();
  if (name.includes("pending triage")) return "blue";
  if (name.includes("pending")) return "green";
  if (name.includes("development")) return "yellow";
  if (name.includes("testing") || name.includes("review")) return "purple";
  return "gray";
}

function labelTone(label) {
  const value = String(label || "").toLowerCase();
  if (value === "bug" || value === "fix") return "red";
  if (value === "feat" || value === "feature") return "brand";
  if (value === "docs") return "blue";
  if (value.includes("integration")) return "teal";
  return "gray";
}

function shippedDate(item) {
  const raw = item.closedAt || item.updatedAt;
  if (!raw) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(raw));
}
</script>

<template>
  <section class="roadmap-kanban-wrap">
    <div
      v-if="columns.length"
      class="roadmap-kanban"
      :style="{ '--roadmap-cols': String(columns.length) }"
    >
      <article
        v-for="column in columns"
        :key="column.name"
        class="roadmap-kanban-column"
        :class="`is-${columnTone(column)}`"
      >
        <header>
          <h3>{{ column.name }}</h3>
          <span>{{ column.items.length }}</span>
        </header>
        <ul>
          <li v-for="(item, index) in column.items" :key="itemKey(item, index)">
            <a class="roadmap-kanban-card" :href="item.url" target="_blank" rel="noreferrer">
              <strong>{{ item.title }}</strong>
              <div v-if="item.labels?.length" class="roadmap-kanban-labels">
                <em v-for="label in item.labels" :key="label" :class="`is-${labelTone(label)}`">{{ label }}</em>
              </div>
              <small v-if="item.number != null && item.repo">{{ item.repo }} #{{ item.number }}</small>
              <small v-else-if="item.number != null">#{{ item.number }}</small>
            </a>
          </li>
        </ul>
      </article>
    </div>

    <section v-if="shipped.length" class="roadmap-shipped">
      <header>
        <h3>Recently shipped</h3>
        <a :href="boardUrl" target="_blank" rel="noreferrer">See all on GitHub</a>
      </header>
      <ul>
        <li v-for="(item, index) in shipped" :key="itemKey(item, index)">
          <a class="roadmap-kanban-card" :href="item.url" target="_blank" rel="noreferrer">
            <strong>{{ item.title }}</strong>
            <div v-if="item.labels?.length" class="roadmap-kanban-labels">
              <em v-for="label in item.labels" :key="label" :class="`is-${labelTone(label)}`">{{ label }}</em>
            </div>
            <small>
              <template v-if="item.number != null">#{{ item.number }}</template>
              <template v-if="shippedDate(item)"> · {{ shippedDate(item) }}</template>
            </small>
          </a>
        </li>
      </ul>
    </section>

    <p v-else-if="!columns.length && fetched" class="roadmap-kanban-empty">
      No open items on the
      <a :href="boardUrl" target="_blank" rel="noreferrer">GitHub board</a>.
    </p>

    <p v-else-if="!columns.length" class="roadmap-kanban-empty">
      Could not load the
      <a :href="boardUrl" target="_blank" rel="noreferrer">GitHub board</a>.
    </p>

    <aside class="roadmap-discord">
      <div>
        <span>Talk</span>
        <h3>Stuck, or have a take?</h3>
        <p>The board is live. Discord is faster than an issue if you just want to poke at it.</p>
      </div>
      <a href="https://discord.gg/dMGhv8j2kx" target="_blank" rel="noreferrer">Join Discord</a>
    </aside>
  </section>
</template>
