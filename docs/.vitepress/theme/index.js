import DefaultTheme from "vitepress/theme";
import CurrentRelease from "./CurrentRelease.vue";
import LatestReleaseNotes from "./LatestReleaseNotes.vue";
import RoadmapBoard from "./RoadmapBoard.vue";
import FeaturesCompare from "./FeaturesCompare.vue";
import FeaturesShots from "./FeaturesShots.vue";
import FaqCards from "./FaqCards.vue";
import IntegrationFilter from "./IntegrationFilter.vue";
import WidgetSnippets from "./WidgetSnippets.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("CurrentRelease", CurrentRelease);
    app.component("LatestReleaseNotes", LatestReleaseNotes);
    app.component("RoadmapBoard", RoadmapBoard);
    app.component("FeaturesCompare", FeaturesCompare);
    app.component("FeaturesShots", FeaturesShots);
    app.component("FaqCards", FaqCards);
    app.component("IntegrationFilter", IntegrationFilter);
    app.component("WidgetSnippets", WidgetSnippets);
  }
};
