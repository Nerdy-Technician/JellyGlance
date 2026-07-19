import axios from "./axios_instance";
import baseUrl from "./baseurl";

let cachedSessions = null;
const listeners = new Set();
const preloadedImages = new Set();

function convertBitrate(bitrate) {
  if (!bitrate) return "N/A";

  const kbps = (bitrate / 1000).toFixed(1);
  const mbps = (bitrate / 1000000).toFixed(1);

  return kbps >= 1000 ? `${mbps} Mbps` : `${kbps} Kbps`;
}

function getVideoResolution(videoHeight) {
  if (videoHeight > 2160) return "8K";
  if (videoHeight > 1080) return "4K";
  if (videoHeight > 720) return "1080p";
  if (videoHeight > 480) return "720p";
  if (videoHeight > 360) return "480p";
  if (videoHeight > 240) return "360p";
  return "240p";
}

function handleLiveTV(row) {
  const nowPlaying = row.NowPlayingItem;
  if (!nowPlaying.RunTimeTicks && nowPlaying?.CurrentProgram) {
    nowPlaying.RunTimeTicks = 0;
    nowPlaying.Name = `${nowPlaying.Name}: ${nowPlaying.CurrentProgram.Name}`;
  }
}

function getContainerStream(row) {
  const transcodeContainer = row.TranscodingInfo ? ` -> ${row.TranscodingInfo.Container.toUpperCase()}` : "";
  let nowPlayingItemContainer = "";

  if (row.NowPlayingItem.Container === undefined) {
    if (row.NowPlayingItem.Type !== undefined && row.NowPlayingItem.Type === "TvChannel") {
      nowPlayingItemContainer = "LiveTV";
    }
  } else {
    nowPlayingItemContainer = row.NowPlayingItem.Container;
  }

  return `${nowPlayingItemContainer.toUpperCase()}${transcodeContainer}`;
}

function getVideoStream(row) {
  const videoStream = row.NowPlayingItem.MediaStreams?.find((stream) => stream.Type === "Video");
  if (videoStream === undefined) return "";

  let transcodeType = "Direct Play";
  let transcodeVideoCodec = "";
  let transcodeVideoResolution = "";
  if (row.TranscodingInfo && !row.TranscodingInfo.IsVideoDirect) {
    transcodeType = "Transcode";
    transcodeVideoResolution = getVideoResolution(row.TranscodingInfo.Height);
    transcodeVideoCodec = ` -> ${row.TranscodingInfo.VideoCodec.toUpperCase()}-${transcodeVideoResolution}`;
  }

  const originalVideoCodec = videoStream.Codec.toUpperCase();
  const videoResolution = getVideoResolution(videoStream.Height);

  return `${transcodeType} (${originalVideoCodec}-${videoResolution}${transcodeVideoCodec})`;
}

function getVideoBitrateStream(row) {
  const videoStream = row.NowPlayingItem.MediaStreams?.find((stream) => stream.Type === "Video");
  if (videoStream === undefined) return "";

  let transcodeBitrate = "";
  if (row.TranscodingInfo && !row.TranscodingInfo.IsVideoDirect) {
    if (row.TranscodingInfo.VideoBitrate) {
      transcodeBitrate = ` -> ${convertBitrate(row.TranscodingInfo.VideoBitrate)}`;
    } else if (row.TranscodingInfo.Bitrate) {
      transcodeBitrate = ` -> ${convertBitrate(row.TranscodingInfo.Bitrate)}`;
    }
  }

  const originalBitrate = videoStream.BitRate ? convertBitrate(videoStream.BitRate) : "";
  return `${originalBitrate}${transcodeBitrate}`;
}

function getAudioStream(row) {
  const mediaTypeAudio = row.NowPlayingItem.Type === "Audio";
  const streamIndex = row.PlayState.AudioStreamIndex;
  if ((streamIndex === undefined || streamIndex === -1) && !mediaTypeAudio) return "";

  let transcodeType = "Direct Play";
  let transcodeCodec = "";
  if (row.TranscodingInfo && !row.TranscodingInfo.IsAudioDirect) {
    transcodeType = "Transcode";
    transcodeCodec = ` -> ${row.TranscodingInfo.AudioCodec.toUpperCase()}-${row.TranscodingInfo.AudioChannels}Ch`;
  }

  let originalCodec = "";
  if (mediaTypeAudio) {
    originalCodec = `${row.NowPlayingItem.Container.toUpperCase()}`;
  } else if (row.NowPlayingItem.MediaStreams?.length && streamIndex < row.NowPlayingItem.MediaStreams.length) {
    originalCodec = `${row.NowPlayingItem.MediaStreams[streamIndex].Codec.toUpperCase()}-${
      row.NowPlayingItem.MediaStreams[streamIndex].Channels
    }Ch`;
  }

  return originalCodec !== "" ? `${transcodeType} (${originalCodec}${transcodeCodec})` : `${transcodeType}`;
}

function getAudioBitrateStream(row) {
  const mediaTypeAudio = row.NowPlayingItem.Type === "Audio";
  const streamIndex = row.PlayState.AudioStreamIndex;
  if ((streamIndex === undefined || streamIndex === -1) && !mediaTypeAudio) return "";

  let transcodeBitRate = "";
  if (row.TranscodingInfo?.AudioBitrate) {
    transcodeBitRate = ` -> ${convertBitrate(row.TranscodingInfo.AudioBitrate)}`;
  }

  let originalBitrate = "";
  if (mediaTypeAudio) {
    originalBitrate = convertBitrate(row.NowPlayingItem.Bitrate);
  } else if (row.NowPlayingItem.MediaStreams?.length && streamIndex < row.NowPlayingItem.MediaStreams.length) {
    originalBitrate = row.NowPlayingItem.MediaStreams[streamIndex].BitRate
      ? convertBitrate(row.NowPlayingItem.MediaStreams[streamIndex].BitRate)
      : "";
  } else if (transcodeBitRate) {
    originalBitrate = "N/A";
  }

  return `${originalBitrate}${transcodeBitRate}`;
}

function getSubtitleStream(row) {
  const subStreamIndex = row.PlayState?.SubtitleStreamIndex;
  if (subStreamIndex === undefined || subStreamIndex === -1) return "";
  return row.NowPlayingItem.MediaStreams?.length ? `${row.NowPlayingItem.MediaStreams[subStreamIndex].DisplayTitle}` : "";
}

function preloadImage(src) {
  if (!src || preloadedImages.has(src)) return;
  preloadedImages.add(src);
  const image = new Image();
  image.decoding = "async";
  image.src = src;
}

export function normalizeSessions(sessionData) {
  if (!Array.isArray(sessionData)) return [];

  return sessionData
    .filter((row) => row.NowPlayingItem !== undefined)
    .map((session) => {
      const nextSession = { ...session, NowPlayingItem: { ...session.NowPlayingItem } };
      handleLiveTV(nextSession);
      nextSession.NowPlayingItem.ContainerStream = getContainerStream(nextSession);
      nextSession.NowPlayingItem.VideoStream = getVideoStream(nextSession);
      nextSession.NowPlayingItem.VideoBitrateStream = getVideoBitrateStream(nextSession);
      nextSession.NowPlayingItem.AudioStream = getAudioStream(nextSession);
      nextSession.NowPlayingItem.AudioBitrateStream = getAudioBitrateStream(nextSession);
      nextSession.NowPlayingItem.SubtitleStream = getSubtitleStream(nextSession);
      return nextSession;
    });
}

export function cacheActiveSessions(sessionData) {
  cachedSessions = normalizeSessions(sessionData);
  cachedSessions.forEach((session) => {
    const itemId = session.NowPlayingItem.SeriesId || session.NowPlayingItem.Id;
    preloadImage(`${baseUrl}/proxy/Items/Images/Primary?id=${itemId}&fillHeight=240&fillWidth=160&quality=45`);
    preloadImage(`${baseUrl}/proxy/Items/Images/Backdrop?id=${itemId}&fillWidth=560&quality=38`);
    if (session.UserId) {
      preloadImage(`${baseUrl}/proxy/Users/Images/Primary?id=${session.UserId}&fillWidth=72&quality=55`);
    }
  });
  listeners.forEach((listener) => listener(cachedSessions));
  return cachedSessions;
}

export function getCachedActiveSessions() {
  return cachedSessions;
}

export function subscribeActiveSessions(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function fetchActiveSessions(token = localStorage.getItem("token")) {
  const response = await axios.get("/proxy/getSessions", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return cacheActiveSessions(response.data);
}

export function prewarmActiveSessions(token = localStorage.getItem("token")) {
  return fetchActiveSessions(token).catch((error) => {
    console.log(error);
    return cachedSessions || [];
  });
}
