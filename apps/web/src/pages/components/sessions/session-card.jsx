/* eslint-disable react/prop-types */
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Card from "react-bootstrap/Card";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Container from "react-bootstrap/Container";
import Modal from "react-bootstrap/Modal";

import AccountCircleFillIcon from "remixicon-react/AccountCircleFillIcon";
import PlayFillIcon from "remixicon-react/PlayFillIcon";
import PauseFillIcon from "remixicon-react/PauseFillIcon";

import { PlatformIcon } from "../../../lib/platform-icons";
import Tooltip from "@mui/material/Tooltip";
import IpInfoModal from "../ip-info";
import { Trans } from "react-i18next";
import baseUrl from "../../../lib/baseurl";

function ticksToTimeString(ticks) {
  // Convert ticks to seconds
  const seconds = Math.floor(ticks / 10000000);
  // Calculate hours, minutes, and remaining seconds
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  // Format the time string as hh:MM:ss
  const timeString = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;

  return timeString;
}

function getETA(NowPlayingItem, PlayState) {
  if (NowPlayingItem.ChannelType && NowPlayingItem.ChannelType === "TV") {
    return NowPlayingItem.CurrentProgram.EndDate
      ? new Date(NowPlayingItem.CurrentProgram.EndDate).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: JSON.parse(localStorage.getItem("12hr")),
        })
      : "";
  }
  let ticks = NowPlayingItem.RunTimeTicks - PlayState.PositionTicks;
  return getETAFromTicks(ticks);
}

function getETAFromTicks(ticks) {
  // Get current date
  const currentDate = Date.now();

  // Calculate ETA
  const etaMillis = currentDate + ticks / 10000;
  const eta = new Date(etaMillis);
  const twelve_hr = JSON.parse(localStorage.getItem("12hr"));

  // Return formated string in user locale
  return eta.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: twelve_hr });
}

function SessionDetailItem({ label, value, wide = false }) {
  if (!value) return null;

  return (
    <div className={`session-popout-detail${wide ? " is-wide" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SessionCardDetailRow({ label, children, className = "" }) {
  return (
    <div className={`session-details-row ${className}`.trim()}>
      <span className="session-details-title text-end text-uppercase">{label}</span>
      <div className="ellipse session-details-value">{children}</div>
    </div>
  );
}

function SessionCard(props) {
  const session = props.data.session;
  const nowPlaying = session.NowPlayingItem;
  const playState = session.PlayState;
  const mediaItemId = props.data.session.NowPlayingItem.SeriesId
    ? props.data.session.NowPlayingItem.SeriesId
    : props.data.session.NowPlayingItem.Id;
  const [loadBackdrop, setLoadBackdrop] = useState(false);
  const [sessionModalVisible, setSessionModalVisible] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setLoadBackdrop(true));
    return () => window.cancelAnimationFrame(frameId);
  }, [mediaItemId]);

  const cardStyle = {
    backgroundImage: loadBackdrop
      ? `url(/proxy/Items/Images/Backdrop?id=${mediaItemId}&fillWidth=560&quality=38), linear-gradient(135deg, var(--primary-color), #0b1119)`
      : "linear-gradient(135deg, rgba(var(--primary-rgb), 0.28), #0b1119)",
    backgroundSize: "cover",
  };

  const cardBgStyle = {
    backdropFilter: "blur(8px)",
    backgroundColor: "rgb(0, 0, 0, 0.46)",
  };
  const progressPercent = nowPlaying.RunTimeTicks
    ? Math.min(
        100,
        Math.max(0, (playState.PositionTicks / nowPlaying.RunTimeTicks) * 100)
      )
    : 0;
  const eta =
    nowPlaying.RunTimeTicks || nowPlaying.ChannelType === "TV"
      ? getETA(nowPlaying, playState)
      : "";
  const playbackMethod = playState.PlayMethod || "Unknown";
  const isTranscoding = Boolean(session.TranscodingInfo);
  const title =
    nowPlaying.Type === "Episode" && nowPlaying.SeriesName
      ? nowPlaying.SeriesName
      : nowPlaying.Name;
  const subtitle =
    nowPlaying.Type === "Episode"
      ? `${nowPlaying.Name} · S${nowPlaying.ParentIndexNumber} E${nowPlaying.IndexNumber}`
      : nowPlaying.Type === "Audio" && nowPlaying.Artists?.length > 0
        ? nowPlaying.Artists[0]
        : nowPlaying.SeriesName || nowPlaying.Type;
  const timecode = `${ticksToTimeString(playState.PositionTicks)}${nowPlaying.RunTimeTicks ? `/${ticksToTimeString(nowPlaying.RunTimeTicks)}` : ""}`;

  const ipv4Regex = new RegExp(
    /\b(?!(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168))(?:(?:2(?:[0-4][0-9]|5[0-5])|[0-1]?[0-9]?[0-9])\.){3}(?:(?:2([0-4][0-9]|5[0-5])|[0-1]?[0-9]?[0-9]))\b/
  );

  const [ipModalVisible, setIPModalVisible] = React.useState(false);
  const [ipAddressLookup, setIPAddressLookup] = React.useState();

  const isRemoteSession = (ipAddress) => {
    ipv4Regex.lastIndex = 0;
    if (ipv4Regex.test(ipAddress ?? ipAddressLookup)) {
      return true;
    }
    return false;
  };

  function showIPDataModal(ipAddress) {
    ipv4Regex.lastIndex = 0;
    setIPAddressLookup(ipAddress);
    if (!isRemoteSession) {
      return;
    }

    setIPModalVisible(true);
  }

  function handleCardClick(event) {
    if (event.target.closest("a, button, [data-session-card-ignore]")) {
      return;
    }

    setSessionModalVisible(true);
  }

  function handleCardKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSessionModalVisible(true);
    }
  }

  return (
    <Card
      className="session-card"
      style={cardStyle}
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      aria-label={`Open session details for ${title}`}
    >
      <div className="card-device-image-overlay">
        <PlatformIcon
          className="card-device-image"
          client={props.data.session.Client}
          deviceName={props.data.session.DeviceName}
        />
      </div>
      <IpInfoModal show={ipModalVisible} onHide={() => setIPModalVisible(false)} ipAddress={ipAddressLookup} />
      <Modal
        show={sessionModalVisible}
        onHide={() => setSessionModalVisible(false)}
        centered
        size="lg"
        dialogClassName="session-popout-modal"
      >
        <Modal.Body>
          <button
            type="button"
            className="session-popout-close"
            onClick={() => setSessionModalVisible(false)}
            aria-label="Close session details"
          >
            ×
          </button>
          <div
            className="session-popout-hero"
            style={{
              backgroundImage: `linear-gradient(90deg, rgba(7, 9, 13, 0.96), rgba(7, 9, 13, 0.68), rgba(7, 9, 13, 0.3)), url(/proxy/Items/Images/Backdrop?id=${mediaItemId}&fillWidth=1200&quality=58)`,
            }}
          >
            <img
              className="session-popout-poster"
              src={`${baseUrl}/proxy/Items/Images/Primary?id=${mediaItemId}&fillHeight=420&fillWidth=280&quality=68`}
              loading="lazy"
              decoding="async"
              alt=""
            />
            <div className="session-popout-copy">
              <div className="session-popout-status">
                <span className={playState.IsPaused ? "is-paused" : "is-playing"}>
                  {playState.IsPaused ? "Paused" : "Playing"}
                </span>
                <span>{playbackMethod}</span>
                {isTranscoding ? <span className="is-transcoding">Transcoding</span> : <span>Direct</span>}
              </div>
              <h2>{title}</h2>
              <p>{subtitle}</p>
              <div className="session-popout-progress" aria-label={`Playback progress ${Math.round(progressPercent)} percent`}>
                <div style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="session-popout-time">
                <strong>{timecode}</strong>
                <span>{eta ? `Ends ${eta}` : "Live or unknown runtime"}</span>
              </div>
            </div>
          </div>
          <div className="session-popout-grid">
            <SessionDetailItem label="Viewer" value={session.UserName} />
            <SessionDetailItem label="Device" value={session.DeviceName} />
            <SessionDetailItem label="Client" value={`${session.Client || "Unknown"} ${session.ApplicationVersion || ""}`.trim()} />
            <SessionDetailItem label="IP address" value={session.RemoteEndPoint} />
            <SessionDetailItem label="Container" value={nowPlaying.ContainerStream} />
            <SessionDetailItem label="Video" value={nowPlaying.VideoStream} wide />
            <SessionDetailItem label="Video bitrate" value={nowPlaying.VideoBitrateStream} />
            <SessionDetailItem label="Audio" value={nowPlaying.AudioStream} wide />
            <SessionDetailItem label="Audio bitrate" value={nowPlaying.AudioBitrateStream} />
            <SessionDetailItem label="Subtitles" value={nowPlaying.SubtitleStream} />
          </div>
        </Modal.Body>
      </Modal>
      <div style={cardBgStyle} className="session-card-main rounded-top">
        <Row className="h-100 p-0 m-0">
          <Col className="session-card-banner-image">
            <Card.Img
              variant="top"
              className={
                props.data.session.NowPlayingItem.Type === "Audio"
                  ? "stat-card-image-audio rounded-0 rounded-start"
                  : "session-card-item-image"
              }
              src={
                baseUrl +
                "/proxy/Items/Images/Primary?id=" +
                mediaItemId +
                "&fillHeight=240&fillWidth=160&quality=45"
              }
              loading="lazy"
              decoding="async"
            />
          </Col>
          <Col className="w-100 h-100 m-0 px-0">
            <Card.Body className="session-card-body w-100 h-100">
              <Container className="h-100 d-flex flex-column justify-content-between g-0">
                <Row className="d-flex justify-content-start session-details">
                  <Col className="session-details-list">
                    <SessionCardDetailRow label={<Trans i18nKey="ACTIVITY_TABLE.DEVICE" />} className="session-details-row-short">
                        <Tooltip title={props.data.session.DeviceName}>
                          <span
                            style={{
                              display: "-webkit-box",
                              WebkitBoxOrient: "vertical",
                              WebkitLineClamp: 1,
                            }}
                          >
                            {props.data.session.DeviceName}
                          </span>
                        </Tooltip>
                    </SessionCardDetailRow>
                    <SessionCardDetailRow label={<Trans i18nKey="ACTIVITY_TABLE.CLIENT" />} className="session-details-row-short">
                        <Tooltip title={props.data.session.Client + " " + props.data.session.ApplicationVersion}>
                          <span
                            style={{
                              display: "-webkit-box",
                              WebkitBoxOrient: "vertical",
                              WebkitLineClamp: 1,
                            }}
                          >
                            {props.data.session.Client + " " + props.data.session.ApplicationVersion}
                          </span>
                        </Tooltip>
                    </SessionCardDetailRow>
                    {props.data.session.NowPlayingItem.ContainerStream !== "" && (
                      <SessionCardDetailRow label={<Trans i18nKey="CONTAINER" />} className="mt-2">
                          <Tooltip title={props.data.session.NowPlayingItem.ContainerStream}>
                            <span
                              style={{
                                display: "-webkit-box",
                                WebkitBoxOrient: "vertical",
                                WebkitLineClamp: 1,
                              }}
                            >
                              {props.data.session.NowPlayingItem.ContainerStream}
                            </span>
                          </Tooltip>
                      </SessionCardDetailRow>
                    )}
                    {props.data.session.NowPlayingItem.VideoStream !== "" && (
                      <SessionCardDetailRow label={<Trans i18nKey="VIDEO" />}>
                          <Tooltip title={props.data.session.NowPlayingItem.VideoStream}>
                            <span
                              style={{
                                display: "-webkit-box",
                                WebkitBoxOrient: "vertical",
                                WebkitLineClamp: 1,
                              }}
                            >
                              {props.data.session.NowPlayingItem.VideoStream}
                            </span>
                          </Tooltip>
                      </SessionCardDetailRow>
                    )}
                    {props.data.session.NowPlayingItem.VideoBitrateStream !== "" && (
                      <SessionCardDetailRow label="">
                          <Tooltip title={props.data.session.NowPlayingItem.VideoBitrateStream}>
                            <span
                              style={{
                                display: "-webkit-box",
                                WebkitBoxOrient: "vertical",
                                WebkitLineClamp: 1,
                              }}
                            >
                              {props.data.session.NowPlayingItem.VideoBitrateStream}
                            </span>
                          </Tooltip>
                      </SessionCardDetailRow>
                    )}
                    {props.data.session.NowPlayingItem.AudioStream !== "" && (
                      <SessionCardDetailRow label={<Trans i18nKey="AUDIO" />}>
                          <Tooltip title={props.data.session.NowPlayingItem.AudioStream}>
                            <span
                              style={{
                                display: "-webkit-box",
                                WebkitBoxOrient: "vertical",
                                WebkitLineClamp: 1,
                              }}
                            >
                              {props.data.session.NowPlayingItem.AudioStream}
                            </span>
                          </Tooltip>
                      </SessionCardDetailRow>
                    )}
                    {props.data.session.NowPlayingItem.AudioBitrateStream !== "" && (
                      <SessionCardDetailRow label="">
                          <Tooltip title={props.data.session.NowPlayingItem.AudioBitrateStream}>
                            <span
                              style={{
                                display: "-webkit-box",
                                WebkitBoxOrient: "vertical",
                                WebkitLineClamp: 1,
                              }}
                            >
                              {props.data.session.NowPlayingItem.AudioBitrateStream}
                            </span>
                          </Tooltip>
                      </SessionCardDetailRow>
                    )}
                    {props.data.session.NowPlayingItem.SubtitleStream !== "" && (
                      <SessionCardDetailRow label={<Trans i18nKey="SUBTITLES" />}>
                          <Tooltip title={props.data.session.NowPlayingItem.SubtitleStream}>
                            <span
                              style={{
                                display: "-webkit-box",
                                WebkitBoxOrient: "vertical",
                                WebkitLineClamp: 1,
                              }}
                            >
                              {props.data.session.NowPlayingItem.SubtitleStream}
                            </span>
                          </Tooltip>
                      </SessionCardDetailRow>
                    )}

                    <SessionCardDetailRow label={<Trans i18nKey="ACTIVITY_TABLE.IP_ADDRESS" />} className="mt-2">
                        {isRemoteSession(props.data.session.RemoteEndPoint) &&
                        (window.env?.JS_GEOLITE_ACCOUNT_ID ?? import.meta.env.JS_GEOLITE_ACCOUNT_ID) ? (
                          <Link
                            className="text-decoration-none text-white"
                            onClick={() => showIPDataModal(props.data.session.RemoteEndPoint)}
                          >
                            {props.data.session.RemoteEndPoint}
                          </Link>
                        ) : (
                          <span>{props.data.session.RemoteEndPoint}</span>
                        )}
                    </SessionCardDetailRow>

                    <SessionCardDetailRow label="ETA">
                        {props.data.session.NowPlayingItem.RunTimeTicks ||
                        props.data.session.NowPlayingItem.ChannelType === "TV" ? (
                          getETA(props.data.session.NowPlayingItem, props.data.session.PlayState)
                        ) : (
                          <Trans i18nKey="ERROR_MESSAGES.N/A" />
                        )}
                    </SessionCardDetailRow>
                  </Col>
                </Row>

                <Row className="p-0 m-0">
                  <Col>
                    <Card.Text className="session-timecode text-end">
                      <Tooltip
                        title={`Ends at ${
                          props.data.session.NowPlayingItem.RunTimeTicks ||
                          props.data.session.NowPlayingItem.ChannelType === "TV" ? (
                            getETA(props.data.session.NowPlayingItem, props.data.session.PlayState)
                          ) : (
                            <Trans i18nKey="ERROR_MESSAGES.N/A" />
                          )
                        }`}
                      >
                        <span className="session-timecode-value">
                          {ticksToTimeString(props.data.session.PlayState.PositionTicks)}
                          {props.data.session.NowPlayingItem.RunTimeTicks
                            ? "/" + ticksToTimeString(props.data.session.NowPlayingItem.RunTimeTicks)
                            : ""}
                        </span>
                      </Tooltip>
                    </Card.Text>
                  </Col>
                </Row>
              </Container>
            </Card.Body>
          </Col>
        </Row>
      </div>
      <Row>
        <Col>
          <div className="progress-bar">
            <div
              className="progress-custom"
              style={{
                width: `${progressPercent}%`,
              }}
            ></div>
          </div>
        </Col>
      </Row>
      <Row className="session-card-meta p-0 m-0">
        <Col className="session-card-now-playing">
          <span className="session-play-state">{props.data.session.PlayState.IsPaused ? <PauseFillIcon /> : <PlayFillIcon />}</span>
          <div className="session-title-copy">
            <Card.Text className="session-title">
              <Link to={`/libraries/item/${props.data.session.NowPlayingItem.Id}`} target="_blank" className="item-name">
                {props.data.session.NowPlayingItem.Type === "Episode" && props.data.session.NowPlayingItem.SeriesName
                  ? props.data.session.NowPlayingItem.SeriesName
                  : props.data.session.NowPlayingItem.Name}
              </Link>
            </Card.Text>
            <Card.Text className="session-subtitle">
              {props.data.session.NowPlayingItem.Type === "Episode"
                ? `${props.data.session.NowPlayingItem.Name} · S${props.data.session.NowPlayingItem.ParentIndexNumber} E${props.data.session.NowPlayingItem.IndexNumber}`
                : props.data.session.NowPlayingItem.Type === "Audio" && props.data.session.NowPlayingItem.Artists?.length > 0
                  ? props.data.session.NowPlayingItem.Artists[0]
                  : props.data.session.NowPlayingItem.SeriesName || props.data.session.NowPlayingItem.Type}
            </Card.Text>
          </div>
        </Col>
        <Col className="session-card-user">
          <Tooltip title={props.data.session.UserName}>
            <Link to={`/users/${props.data.session.UserId}`} className="item-name session-user-name">
              {props.data.session.UserName}
            </Link>
          </Tooltip>
          {props.data.session.UserPrimaryImageTag !== undefined ? (
            <img
              className="session-card-user-image"
              src={baseUrl + "/proxy/Users/Images/Primary?id=" + props.data.session.UserId + "&fillWidth=72&quality=55"}
              loading="lazy"
              decoding="async"
              alt=""
            />
          ) : (
            <AccountCircleFillIcon className="session-card-user-image" />
          )}
        </Col>
      </Row>
    </Card>
  );
}

export default SessionCard;
