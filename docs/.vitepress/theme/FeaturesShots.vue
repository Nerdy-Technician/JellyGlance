<script setup>
const shots = [
  {
    href: "/guide/screenshots",
    src: "/screenshots/home.png",
    title: "Session command",
    detail: "See who is playing, stop a stream, or send a note to the TV."
  },
  {
    href: "/guide/screenshots",
    src: "/screenshots/downloads.png",
    title: "Download queues",
    detail: "Torrent and Usenet progress next to the request that started them."
  },
  {
    href: "/guide/screenshots",
    src: "/screenshots/calendar.png",
    title: "Release calendar",
    detail: "Upcoming Sonarr, Radarr, and Lidarr dates in one place."
  },
  {
    href: "/guide/screenshots",
    src: "/screenshots/settings-kiosk.png",
    title: "Kiosk layout",
    detail: "Family TV or admin desk. Same app, different widgets."
  }
];
</script>

<template>
  <section class="features-shots">
    <header>
      <span>Only in Glance</span>
      <h2>The ticks that need a picture.</h2>
    </header>
    <div>
      <a v-for="shot in shots" :key="shot.title" :href="shot.href">
        <img :src="shot.src" :alt="shot.title">
        <strong>{{ shot.title }}</strong>
        <small>{{ shot.detail }}</small>
      </a>
    </div>
  </section>
</template>
