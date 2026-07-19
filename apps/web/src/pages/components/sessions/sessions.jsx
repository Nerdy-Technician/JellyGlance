import { useState, useEffect } from "react";
import Config from "../../../lib/config";
// import API from "../../../classes/jellyfin-api";

import "../../css/sessions.css";
import ErrorBoundary from "../general/ErrorBoundary";
import SessionCard from "./session-card";

import socket from "../../../socket";
import {
  cacheActiveSessions,
  fetchActiveSessions,
  getCachedActiveSessions,
  subscribeActiveSessions,
} from "../../../lib/session-cache";

function Sessions() {
  const [data, setData] = useState(() => getCachedActiveSessions());
  const [config, setConfig] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("config") || "null");
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const unsubscribe = subscribeActiveSessions(setData);
    const handleSessions = (sessionData) => {
      if (typeof sessionData === "object" && Array.isArray(sessionData)) {
        cacheActiveSessions(sessionData);
      }
    };

    socket.on("sessions", handleSessions);

    fetchActiveSessions().catch((error) => console.log(error));

    return () => {
      unsubscribe();
      socket.off("sessions", handleSessions);
    };
  }, []);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const newConfig = await Config.getConfig();
        setConfig(newConfig);
      } catch (error) {
        console.log(error);
      }
    };

    if (!config) {
      fetchConfig();
    }
  }, [config]);

  if (!config && !data) {
    return (
      <div>
        <h1 className="my-3">
          Active Sessions
        </h1>
        <div className="sessions-loading-strip" aria-hidden="true">
          <span />
          <span />
        </div>
      </div>
    );
  }

  if ((!data && config) || data.length === 0) {
    return (
      <div>
        <h1 className="my-3">
          Active Sessions
        </h1>
        <div className="sessions-empty-state">
          No Active Sessions Found
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="my-3">
        Active Sessions
      </h1>
      <div className="sessions-container">
        {data &&
          data.length > 0 &&
          data
            .sort((a, b) => a.Id.padStart(12, "0").localeCompare(b.Id.padStart(12, "0")))
            .map((session) => (
              <ErrorBoundary key={session.Id}>
                <SessionCard data={{ session: session, base_url: config?.base_url }} />
              </ErrorBoundary>
            ))}
      </div>
    </div>
  );
}

export default Sessions;
