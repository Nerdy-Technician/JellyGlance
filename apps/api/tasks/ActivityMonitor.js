const db = require("../db");

const dayjs = require("dayjs");
const { columnsPlayback } = require("../models/jf_playback_activity");
const { jf_activity_watchdog_columns, jf_activity_watchdog_mapping } = require("../models/jf_activity_watchdog");
const configClass = require("../classes/config");
const API = require("../classes/api-loader");
const { sendUpdate } = require("../ws");
const { isNumber } = require("../utils/typeValidation");
const WebhookManager = require("../classes/webhook-manager");

const MINIMUM_SECONDS_TO_INCLUDE_PLAYBACK = process.env.MINIMUM_SECONDS_TO_INCLUDE_PLAYBACK
  ? Number(process.env.MINIMUM_SECONDS_TO_INCLUDE_PLAYBACK)
  : 1;

const NEW_WATCH_EVENT_THRESHOLD_HOURS = process.env.NEW_WATCH_EVENT_THRESHOLD_HOURS
  ? Math.max(Math.min(Number(process.env.NEW_WATCH_EVENT_THRESHOLD_HOURS), 12), 1)
  : 1;

const webhookManager = new WebhookManager();

function playbackWebhookData(session, ended = false) {
  const item = session.NowPlayingItem;
  const posterItemId = item?.SeriesId || item?.Id || session.NowPlayingItemId;
  const episodeId = item?.SeriesId ? item.Id : session.EpisodeId;
  return {
    sessionInfo: {
      userId: session.UserId,
      deviceId: session.DeviceId,
      deviceName: session.DeviceName,
      clientName: session.Client,
      applicationVersion: session.ApplicationVersion,
      playMethod: session.PlayMethod || session.PlayState?.PlayMethod,
      isPaused: Boolean(session.IsPaused ?? session.PlayState?.IsPaused),
      playbackDuration: Number(session.PlaybackDuration || 0),
      startTime: session.ActivityDateInserted,
      endTime: ended ? new Date().toISOString() : undefined,
    },
    userData: {
      username: session.UserName,
      userId: session.UserId,
      userImageTag: session.UserPrimaryImageTag,
    },
    mediaInfo: {
      itemId: item?.Id || session.NowPlayingItemId,
      posterItemId,
      episodeId,
      seasonId: item?.SeasonId || session.SeasonId,
      seasonNumber: session.SeasonNumber ?? item?.ParentIndexNumber,
      episodeNumber: session.EpisodeNumber ?? item?.IndexNumber,
      mediaType: episodeId || item?.SeriesId ? "Episode" : "Movie",
      mediaName: session.NowPlayingItemName || item?.Name,
      seriesName: session.SeriesName || item?.SeriesName,
      playMethod: session.PlayMethod || session.PlayState?.PlayMethod,
    },
  };
}

function sessionMatchesWatchdog(sessionData, wdData) {
  return wdData.UserId === sessionData.UserId;
}

function applyLiveSessionToWatchdog(wdData, sessionData) {
  const mapped = jf_activity_watchdog_mapping(sessionData);
  let changed = wdData.NowPlayingItemId !== mapped.NowPlayingItemId
    || wdData.EpisodeId !== mapped.EpisodeId
    || wdData.DeviceId !== mapped.DeviceId
    || wdData.IsPaused != mapped.IsPaused
    || wdData.NowPlayingItemName !== mapped.NowPlayingItemName
    || wdData.Client !== mapped.Client;

  if (!changed) return false;

  wdData.DeviceId = mapped.DeviceId;
  wdData.DeviceName = mapped.DeviceName;
  wdData.Client = mapped.Client;
  wdData.ApplicationVersion = mapped.ApplicationVersion;
  wdData.NowPlayingItemId = mapped.NowPlayingItemId;
  wdData.NowPlayingItemName = mapped.NowPlayingItemName;
  wdData.EpisodeId = mapped.EpisodeId;
  wdData.SeasonId = mapped.SeasonId;
  wdData.SeriesName = mapped.SeriesName;
  wdData.PlayMethod = mapped.PlayMethod;
  wdData.UserPrimaryImageTag = mapped.UserPrimaryImageTag;
  wdData.SeasonNumber = mapped.SeasonNumber;
  wdData.EpisodeNumber = mapped.EpisodeNumber;
  wdData.MediaStreams = mapped.MediaStreams;
  wdData.TranscodingInfo = mapped.TranscodingInfo;
  wdData.PlayState = mapped.PlayState;
  wdData.OriginalContainer = mapped.OriginalContainer;
  wdData.RemoteEndPoint = mapped.RemoteEndPoint;
  wdData.ServerId = mapped.ServerId;

  if (wdData.IsPaused != mapped.IsPaused) {
    if (mapped.IsPaused == true) {
      const startTime = dayjs(wdData.ActivityDateInserted);
      const lastPausedDate = dayjs(sessionData.LastPausedDate, "YYYY-MM-DD HH:mm:ss.SSSZ");
      wdData.PlaybackDuration = parseInt(wdData.PlaybackDuration) + lastPausedDate.diff(startTime, "seconds");
      wdData.ActivityDateInserted = `${lastPausedDate.format("YYYY-MM-DD HH:mm:ss.SSSZ")}`;
    } else {
      wdData.ActivityDateInserted = dayjs().format("YYYY-MM-DD HH:mm:ss.SSSZ");
    }
  }
  wdData.IsPaused = mapped.IsPaused;
  return true;
}

async function getSessionsInWatchDog(SessionData, WatchdogData) {
  return WatchdogData.filter((wdData) => {
    const sessionData = SessionData.find((session) => sessionMatchesWatchdog(session, wdData));
    if (!sessionData) return false;
    return applyLiveSessionToWatchdog(wdData, sessionData);
  });
}

async function getSessionsNotInWatchDog(SessionData, WatchdogData) {
  return SessionData.filter((sessionData) => {
    if (WatchdogData.length === 0) return true;
    return !WatchdogData.some((wdData) => sessionMatchesWatchdog(sessionData, wdData));
  }).map(jf_activity_watchdog_mapping);
}

function getWatchDogNotInSessions(SessionData, WatchdogData) {
  const removedData = WatchdogData.filter((wdData) => {
    if (SessionData.length === 0) return true;
    return !SessionData.some((sessionData) => sessionMatchesWatchdog(sessionData, wdData));
  });

  //this is to update the playback duration for the removed items where it was playing before stopped as duration is only updated on pause

  removedData.map((obj) => {
    obj.Id = obj.ActivityId;
    const startTime = dayjs(obj.ActivityDateInserted);
    const endTime = dayjs();

    const diffInSeconds = endTime.diff(startTime, "seconds");

    if (obj.IsPaused == false) {
      obj.PlaybackDuration = parseInt(obj.PlaybackDuration) + diffInSeconds;
    }

    obj.ActivityDateInserted = endTime.format("YYYY-MM-DD HH:mm:ss.SSSZ");
    const { ...rest } = obj;

    return { ...rest };
  });
  return removedData;
}

let currentIntervalId = null;
let lastHadActiveSessions = false;
let emptySessionPolls = 0;
let cachedPollingSettings = {
  activeSessionsInterval: 1000,
  idleInterval: 5000,
};

const PLAYBACK_END_GRACE_MS = Number(process.env.PLAYBACK_WEBHOOK_END_GRACE_MS) || 90_000;
const PAUSED_END_GRACE_MS = Number(process.env.PLAYBACK_WEBHOOK_PAUSED_GRACE_MS) || 30 * 60 * 1000;
const FIRST_START_STABLE_MS = 2500;
const ITEM_CHANGE_STABLE_MS = 8000;
const playbackNotifyState = new Map();

function playingItemKey(session) {
  const item = session.NowPlayingItem;
  if (item?.SeriesId) return String(item.Id || session.EpisodeId || "");
  return String(item?.Id || session.EpisodeId || session.NowPlayingItemId || "");
}

function sessionIsPaused(session) {
  return Boolean(session?.PlayState?.IsPaused ?? session?.IsPaused);
}

function sessionsByUser(SessionData) {
  const byUser = new Map();
  for (const session of SessionData) {
    const userId = session.UserId;
    if (!userId) continue;
    const prev = playbackNotifyState.get(userId);
    const key = playingItemKey(session);
    const current = byUser.get(userId);
    if (!current) {
      byUser.set(userId, session);
      continue;
    }
    if (prev?.lastNotifiedItemKey && key === prev.lastNotifiedItemKey) {
      byUser.set(userId, session);
    }
  }
  return byUser;
}

function collectPlaybackNotifications(SessionData, now = Date.now()) {
  const byUser = sessionsByUser(SessionData);
  const started = [];

  for (const [userId, session] of byUser) {
    const itemKey = playingItemKey(session);
    const paused = sessionIsPaused(session);
    const prev = playbackNotifyState.get(userId) || {};

    if (!itemKey) {
      playbackNotifyState.set(userId, { ...prev, lastSeen: now, session, isPaused: paused, notified: Boolean(prev.notified) });
      continue;
    }

    if (paused) {
      playbackNotifyState.set(userId, {
        ...prev,
        lastSeen: now,
        session,
        itemKey,
        isPaused: true,
        pendingItemKey: null,
        pendingSince: null,
      });
      continue;
    }

    if (!prev.notified) {
      const pendingSince = prev.pendingItemKey === itemKey ? prev.pendingSince : now;
      const stable = now - pendingSince >= FIRST_START_STABLE_MS;
      playbackNotifyState.set(userId, {
        ...prev,
        lastSeen: now,
        session,
        itemKey,
        isPaused: false,
        pendingItemKey: itemKey,
        pendingSince,
        notified: stable,
        lastNotifiedItemKey: stable ? itemKey : prev.lastNotifiedItemKey,
        lastItemNotifyAt: stable ? now : prev.lastItemNotifyAt,
      });
      if (stable) started.push(session);
      continue;
    }

    if (itemKey === prev.lastNotifiedItemKey) {
      playbackNotifyState.set(userId, {
        ...prev,
        lastSeen: now,
        session,
        itemKey,
        isPaused: false,
        pendingItemKey: null,
        pendingSince: null,
      });
      continue;
    }

    const pendingSince = prev.pendingItemKey === itemKey ? prev.pendingSince : now;
    const stable = now - pendingSince >= ITEM_CHANGE_STABLE_MS;
    playbackNotifyState.set(userId, {
      ...prev,
      lastSeen: now,
      session,
      itemKey,
      isPaused: false,
      pendingItemKey: itemKey,
      pendingSince,
      lastNotifiedItemKey: stable ? itemKey : prev.lastNotifiedItemKey,
      lastItemNotifyAt: stable ? now : prev.lastItemNotifyAt,
    });
    if (stable) started.push(session);
  }

  const ended = [];
  for (const [userId, state] of playbackNotifyState) {
    if (byUser.has(userId)) continue;
    if (!state.notified) {
      playbackNotifyState.delete(userId);
      continue;
    }
    const grace = state.isPaused ? PAUSED_END_GRACE_MS : PLAYBACK_END_GRACE_MS;
    if (now - state.lastSeen < grace) continue;
    ended.push(state.session);
    playbackNotifyState.delete(userId);
  }

  return { started, ended };
}

async function ActivityMonitor(defaultInterval) {
  // console.log("Activity Monitor started with default interval: " + defaultInterval);

  const runMonitoring = async () => {
    try {
      const config = await new configClass().getConfig();

      if (config.error || config.state !== 2) {
        return;
      }

      // Get adaptive polling settings from config
      const pollingSettings = config.settings?.ActivityMonitorPolling || {
        activeSessionsInterval: 1000,
        idleInterval: 5000,
      };

      // Check if polling settings have changed
      const settingsChanged =
        cachedPollingSettings.activeSessionsInterval !== pollingSettings.activeSessionsInterval ||
        cachedPollingSettings.idleInterval !== pollingSettings.idleInterval;

      if (settingsChanged) {
        console.log("[ActivityMonitor] Polling settings changed, updating intervals");
        console.log("Old settings:", cachedPollingSettings);
        console.log("New settings:", pollingSettings);
        cachedPollingSettings = { ...pollingSettings };
      }

      const ExcludedUsers = config.settings?.ExcludedUsers || [];
      const apiSessionData = await API.getSessions();
      const SessionData = apiSessionData.filter(
        (row) => row.NowPlayingItem !== undefined && row.UserId && !ExcludedUsers.includes(row.UserId),
      );
      sendUpdate("sessions", apiSessionData);

      const hasActiveSessions = SessionData.length > 0;

      // Determine current appropriate interval
      const currentInterval = hasActiveSessions ? pollingSettings.activeSessionsInterval : pollingSettings.idleInterval;

      // Check if we need to change the interval (either due to session state change OR settings change)
      if (hasActiveSessions !== lastHadActiveSessions || settingsChanged) {
        if (hasActiveSessions !== lastHadActiveSessions) {
          console.log(
            `[ActivityMonitor] Switching to ${hasActiveSessions ? "active" : "idle"} polling mode (${currentInterval}ms)`,
          );
          lastHadActiveSessions = hasActiveSessions;
        }
        if (settingsChanged) {
          console.log(`[ActivityMonitor] Applying new ${hasActiveSessions ? "active" : "idle"} interval: ${currentInterval}ms`);
        }

        if (currentIntervalId) {
          clearInterval(currentIntervalId);
        }
        currentIntervalId = setInterval(runMonitoring, currentInterval);
      }

      const { started: playbackStarted, ended: playbackEnded } = collectPlaybackNotifications(SessionData);
      if (playbackStarted.length > 0) {
        await Promise.all(
          playbackStarted.map((session) => webhookManager.triggerEventWebhooks("playback_started", playbackWebhookData(session))),
        );
      }
      if (playbackEnded.length > 0) {
        await Promise.all(
          playbackEnded.map((session) => webhookManager.triggerEventWebhooks("playback_ended", playbackWebhookData(session, true))),
        );
      }
      await webhookManager.flushQuietHoursDigest();

      const WatchdogData = await db.query("SELECT * FROM jf_activity_watchdog").then((res) => res.rows);

      if (SessionData.length === 0 && WatchdogData.length === 0) {
        emptySessionPolls = 0;
        return;
      }

      if (SessionData.length === 0 && WatchdogData.length > 0) {
        emptySessionPolls += 1;
        if (emptySessionPolls < 8) {
          return;
        }
      } else {
        emptySessionPolls = 0;
      }

      const WatchdogDataToInsert = await getSessionsNotInWatchDog(SessionData, WatchdogData);
      const WatchdogDataToUpdate = await getSessionsInWatchDog(SessionData, WatchdogData);
      const dataToRemove = await getWatchDogNotInSessions(SessionData, WatchdogData);

      if (WatchdogDataToInsert.length > 0) {
        await db.insertBulk("jf_activity_watchdog", WatchdogDataToInsert, jf_activity_watchdog_columns);
        console.log("New Data Inserted: ", WatchdogDataToInsert.length);
      }

      //update wd state
      if (WatchdogDataToUpdate.length > 0) {
        await db.insertBulk("jf_activity_watchdog", WatchdogDataToUpdate, jf_activity_watchdog_columns);
        console.log("Existing Data Updated: ", WatchdogDataToUpdate.length);
      }

      if (dataToRemove.length > 0) {
        const toDeleteIds = dataToRemove.map((row) => row.ActivityId);

        //delete from db no longer in session data and insert into stats db
        //Bulk delete from db thats no longer on api

        let playbackToInsert = dataToRemove;

        if (playbackToInsert.length == 0 && toDeleteIds.length == 0) {
          return;
        }

        /////get data from jf_playback_activity within the last hour with progress of <=80% for current items in session

        const ExistingRecords = await db
          .query(`SELECT * FROM jf_recent_playback_activity(${NEW_WATCH_EVENT_THRESHOLD_HOURS})`)
          .then((res) => {
            if (res.rows && Array.isArray(res.rows) && res.rows.length > 0) {
              return res.rows.filter(
                (row) =>
                  playbackToInsert.some(
                    (pbi) => pbi.NowPlayingItemId === row.NowPlayingItemId && pbi.EpisodeId === row.EpisodeId,
                  ) && row.Progress <= 80.0,
              );
            } else {
              return [];
            }
          })
          .catch((err) => {
            console.error("Error fetching existing records:", err);
          });
        let ExistingDataToUpdate = [];

        //for each item in playbackToInsert, check if it exists in the recent playback activity and update accordingly. insert new row if updating existing exceeds the runtime
        if (playbackToInsert.length > 0 && ExistingRecords.length > 0) {
          ExistingDataToUpdate = playbackToInsert.filter((playbackData) => {
            const existingrow = ExistingRecords.find((existing) => {
              let newDurationWithingRunTime = true;

              if (existing.RunTimeTicks != undefined && isNumber(existing.RunTimeTicks)) {
                newDurationWithingRunTime =
                  (Number(existing.PlaybackDuration) + Number(playbackData.PlaybackDuration)) * 10000000 <=
                  Number(existing.RunTimeTicks);
              }
              return (
                existing.NowPlayingItemId === playbackData.NowPlayingItemId &&
                existing.EpisodeId === playbackData.EpisodeId &&
                existing.UserId === playbackData.UserId &&
                newDurationWithingRunTime
              );
            });

            if (existingrow) {
              playbackData.Id = existingrow.Id;
              playbackData.PlaybackDuration = Number(existingrow.PlaybackDuration) + Number(playbackData.PlaybackDuration);
              playbackData.ActivityDateInserted = dayjs().format("YYYY-MM-DD HH:mm:ss.SSSZ");
              return true;
            }
            return false;
          });
        }

        //remove items from playbackToInsert that already exists in the recent playback activity so it doesnt duplicate or where PlaybackDuration===0
        playbackToInsert = playbackToInsert.filter(
          (pb) =>
            pb.PlaybackDuration >= MINIMUM_SECONDS_TO_INCLUDE_PLAYBACK &&
            !ExistingRecords.some(
              (er) => er.NowPlayingItemId === pb.NowPlayingItemId && er.EpisodeId === pb.EpisodeId && er.UserId === pb.UserId,
            ),
        );

        //remove items where PlaybackDuration===0

        ExistingDataToUpdate = ExistingDataToUpdate.filter((pb) => pb.PlaybackDuration >= MINIMUM_SECONDS_TO_INCLUDE_PLAYBACK);

        if (toDeleteIds.length > 0) {
          await db.deleteBulk("jf_activity_watchdog", toDeleteIds, "ActivityId");
          console.log("Removed Data from WD Count: ", dataToRemove.length);
        }
        if (playbackToInsert.length > 0) {
          await db.insertBulk("jf_playback_activity", playbackToInsert, columnsPlayback);
          console.log("Activity inserted/updated Count: ", playbackToInsert.length);
          // console.log("Inserted " + playbackToInsert.length + " new playback records");
        }

        if (ExistingDataToUpdate.length > 0) {
          await db.insertBulk("jf_playback_activity", ExistingDataToUpdate, columnsPlayback);
          // console.log("Updated " + playbackToInsert.length + " playback records");
        }

        ///////////////////////////
      }
    } catch (error) {
      if (error?.code === "ECONNREFUSED") {
        console.error("Error: Unable to connect to API"); //TO-DO Change this to correct API name
      } else if (error?.code === "ERR_BAD_RESPONSE") {
        console.warn(error.response?.data);
      } else {
        console.error(error);
      }
      return [];
    }
  };

  // Get initial configuration to start with the correct interval
  const initConfig = async () => {
    try {
      const config = await new configClass().getConfig();

      if (config.error || config.state !== 2) {
        console.log("[ActivityMonitor] Config not ready, starting with default interval:", defaultInterval + "ms");
        currentIntervalId = setInterval(runMonitoring, defaultInterval);
        return;
      }

      // Get adaptive polling settings from config
      const pollingSettings = config.settings?.ActivityMonitorPolling || {
        activeSessionsInterval: 1000,
        idleInterval: 5000,
      };

      // Initialize cached settings
      cachedPollingSettings = { ...pollingSettings };

      // Start with idle interval since there are likely no active sessions at startup
      const initialInterval = pollingSettings.idleInterval;
      console.log("[ActivityMonitor] Starting adaptive polling with idle interval:", initialInterval + "ms");
      console.log("[ActivityMonitor] Loaded settings:", pollingSettings);
      currentIntervalId = setInterval(runMonitoring, initialInterval);
    } catch (error) {
      console.log("[ActivityMonitor] Error loading config, using default interval:", defaultInterval + "ms");
      currentIntervalId = setInterval(runMonitoring, defaultInterval);
    }
  };

  // Initialize with proper configuration
  await initConfig();

  // Return a cleanup function
  return () => {
    if (currentIntervalId) {
      clearInterval(currentIntervalId);
      currentIntervalId = null;
    }
  };
}

module.exports = {
  ActivityMonitor,
};
