import DefaultTheme from "vitepress/theme";
import CurrentRelease from "./CurrentRelease.vue";
import LatestReleaseNotes from "./LatestReleaseNotes.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("CurrentRelease", CurrentRelease);
    app.component("LatestReleaseNotes", LatestReleaseNotes);
  },
};
