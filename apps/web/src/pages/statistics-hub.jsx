import { lazy } from "react";
import BarChartLineIcon from "remixicon-react/BarChartLineIcon";
import PageTabs from "./components/general/PageTabs";
import { INSIGHT_TABS } from "./insights";

const Statistics = lazy(() => import("./statistics"));

export default function StatisticsHub() {
  const tabs = [
    { id: "overview", label: "Overview", icon: BarChartLineIcon, render: () => <Statistics /> },
    ...INSIGHT_TABS.map((tab) => ({
      id: tab.id,
      label: tab.label,
      icon: tab.icon,
      render: () => (
        <main className="insights-page">
          <tab.Component />
        </main>
      ),
    })),
  ];
  return <PageTabs title="Statistics" tabs={tabs} />;
}
