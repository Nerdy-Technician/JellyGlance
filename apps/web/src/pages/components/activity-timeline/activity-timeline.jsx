/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import axios from "../../../lib/axios_instance";

import Timeline from "@mui/lab/Timeline";
import { useMediaQuery, useTheme } from "@mui/material";
import { Button } from "react-bootstrap";

import "../../css/timeline/activity-timeline.css";

import Loading from "../../../pages/components/general/loading.jsx";

import ActivityTimelineItem from "./activity-timeline-item.jsx";
import { groupAdjacentSeasons } from "./helpers.jsx";

const PAGE_SIZE = 40;

export default function ActivityTimelineComponent(props) {
  const { userId, libraries } = props;
  const theme = useTheme();
  const shouldRenderVertically = useMediaQuery(theme.breakpoints.down("sm"));

  const [rawEntries, setRawEntries] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setRawEntries([]);
    setHasMore(false);

    axios
      .post(
        "/api/getActivityTimeLine",
        { userId, libraries: libraries || [], limit: PAGE_SIZE, offset: 0 },
        { signal: controller.signal }
      )
      .then((response) => {
        if (cancelled) {
          return;
        }

        const payload = Array.isArray(response.data) ? { results: response.data, hasMore: false } : response.data;
        setRawEntries(payload.results || []);
        setHasMore(Boolean(payload.hasMore));
        setIsLoading(false);
      })
      .catch((error) => {
        if (cancelled || error.code === "ERR_CANCELED") {
          return;
        }
        console.log(error);
        setRawEntries([]);
        setHasMore(false);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [userId, libraries]);

  const loadMore = () => {
    if (isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);
    axios
      .post("/api/getActivityTimeLine", {
        userId,
        libraries: libraries || [],
        limit: PAGE_SIZE,
        offset: rawEntries.length,
      })
      .then((response) => {
        const payload = Array.isArray(response.data) ? { results: response.data, hasMore: false } : response.data;
        setRawEntries((current) => [...current, ...(payload.results || [])]);
        setHasMore(Boolean(payload.hasMore));
      })
      .catch((error) => {
        console.log(error);
      })
      .finally(() => {
        setIsLoadingMore(false);
      });
  };

  if (isLoading) {
    return <Loading />;
  }

  const timelineEntries = groupAdjacentSeasons([...rawEntries]);

  if (!timelineEntries.length) {
    return <div className="activity-timeline-empty">No timeline activity for this user and library filter.</div>;
  }

  return (
    <div>
      <Timeline position="alternate">
        {timelineEntries.map((entry, index) => (
          <ActivityTimelineItem
            key={`${entry.NowPlayingItemId}-${entry.FirstActivityDate}-${entry.LastActivityDate}`}
            shouldRenderVertically={shouldRenderVertically}
            eager={index < 6}
            {...entry}
          />
        ))}
      </Timeline>
      {hasMore && (
        <div className="activity-timeline-more">
          <Button variant="outline-primary" onClick={loadMore} disabled={isLoadingMore}>
            {isLoadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
