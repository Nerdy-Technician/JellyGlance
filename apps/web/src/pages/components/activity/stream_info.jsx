import React from "react";
import "../../css/activity/stream-info.css";
import Loading from "../general/loading";
import { Trans } from "react-i18next";
import i18next from "i18next";

const UNKNOWN_VALUE = "-";

function convertBitrate(bitrate) {
  const numericBitrate = Number(bitrate);
  if (!Number.isFinite(numericBitrate) || numericBitrate <= 0) {
    return UNKNOWN_VALUE;
  }

  const kbps = numericBitrate / 1000;
  if (kbps >= 1000) {
    return `${(numericBitrate / 1000000).toFixed(1)} Mbps`;
  }
  return `${kbps.toFixed(1)} Kbps`;
}

function formatValue(value) {
  if (value === undefined || value === null || value === "") {
    return UNKNOWN_VALUE;
  }
  return value;
}

function formatUpper(value) {
  const formattedValue = formatValue(value);
  return formattedValue === UNKNOWN_VALUE ? UNKNOWN_VALUE : String(formattedValue).toUpperCase();
}

function streamMode(data, type) {
  if (data.PlayMethod === "DirectStream") {
    return i18next.t("DIRECT_STREAM");
  }

  if (!data.TranscodingInfo) {
    return i18next.t("DIRECT");
  }

  const isDirect = type === "video" ? data.TranscodingInfo?.IsVideoDirect : data.TranscodingInfo?.IsAudioDirect;
  return isDirect ? i18next.t("DIRECT") : i18next.t("TRANSCODE");
}

function modeClass(mode) {
  return `is-${String(mode).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function DetailRow({ label, stream, source }) {
  return (
    <div className="stream-info-row">
      <span>{label}</span>
      <strong>{stream}</strong>
      <strong>{source}</strong>
    </div>
  );
}

function DetailSection({ title, mode, rows }) {
  return (
    <section className="stream-info-section">
      <div className="stream-info-section-header">
        <h3>{title}</h3>
        {mode ? <span className={`stream-info-mode ${modeClass(mode)}`}>{mode}</span> : null}
      </div>
      <div className="stream-info-row stream-info-columns" aria-hidden="true">
        <span />
        <strong>
          <Trans i18nKey="STREAM_DETAILS" />
        </strong>
        <strong>
          <Trans i18nKey="SOURCE_DETAILS" />
        </strong>
      </div>
      <div className="stream-info-rows">{rows}</div>
    </section>
  );
}

function StreamDetails({ data }) {
  if (!data || !data.MediaStreams) {
    return null;
  }

  const videoStream = data.MediaStreams.find((stream) => stream.Type === "Video");
  const audioStream = data.MediaStreams.find((stream) => stream.Type === "Audio");

  const originalBitrateRaw = Number(videoStream?.BitRate || 0) + Number(audioStream?.BitRate || 0);
  const overallOriginalBitrate = convertBitrate(originalBitrateRaw);

  let transcodeBitrateRaw = originalBitrateRaw;
  if (data.TranscodingInfo) {
    if (
      (data.TranscodingInfo.IsVideoDirect === false && data.TranscodingInfo.VideoBitrate) ||
      (data.TranscodingInfo.IsAudioDirect === false && data.TranscodingInfo.AudioBitrate)
    ) {
      transcodeBitrateRaw += data.TranscodingInfo.IsVideoDirect === false ? Number(data.TranscodingInfo.VideoBitrate || 0) : 0;
      transcodeBitrateRaw += data.TranscodingInfo.IsAudioDirect === false ? Number(data.TranscodingInfo.AudioBitrate || 0) : 0;
      if (data.TranscodingInfo.IsVideoDirect === false && videoStream?.BitRate) {
        transcodeBitrateRaw -= Number(videoStream.BitRate);
      }
      if (data.TranscodingInfo.IsAudioDirect === false && audioStream?.BitRate) {
        transcodeBitrateRaw -= Number(audioStream.BitRate);
      }
    } else {
      transcodeBitrateRaw = data.TranscodingInfo?.Bitrate;
    }
  }

  const videoTranscodeBitrate =
    data.TranscodingInfo && data.TranscodingInfo?.IsVideoDirect === false
      ? convertBitrate(data.TranscodingInfo.VideoBitrate || data.TranscodingInfo.Bitrate)
      : convertBitrate(videoStream?.BitRate);
  const videoMode = streamMode(data, "video");
  const audioMode = streamMode(data, "audio");
  const transcodeReasons = data.TranscodingInfo?.TranscodeReasons || [];

  return (
    <>
      <div className="stream-info-summary">
        <div>
          <span>Playback</span>
          <strong>{data.PlayMethod || i18next.t("DIRECT")}</strong>
        </div>
        <div>
          <span>Stream</span>
          <strong>{convertBitrate(transcodeBitrateRaw)}</strong>
        </div>
        <div>
          <span>Source</span>
          <strong>{overallOriginalBitrate}</strong>
        </div>
      </div>

      <DetailSection
        title={<Trans i18nKey="MEDIA" />}
        rows={
          <>
            <DetailRow label={<Trans i18nKey="BITRATE" />} stream={convertBitrate(transcodeBitrateRaw)} source={overallOriginalBitrate} />
            <DetailRow
              label={<Trans i18nKey="CONTAINER" />}
              stream={formatUpper(data.TranscodingInfo ? data.TranscodingInfo.Container : data.OriginalContainer)}
              source={formatUpper(data.OriginalContainer)}
            />
          </>
        }
      />

      <DetailSection
        title={<Trans i18nKey="VIDEO" />}
        mode={videoMode}
        rows={
          <>
            <DetailRow
              label={<Trans i18nKey="CODEC" />}
              stream={formatUpper(data.TranscodingInfo ? data.TranscodingInfo.VideoCodec : videoStream?.Codec)}
              source={formatUpper(videoStream?.Codec)}
            />
            <DetailRow label={<Trans i18nKey="BITRATE" />} stream={videoTranscodeBitrate} source={convertBitrate(videoStream?.BitRate)} />
            <DetailRow
              label={<Trans i18nKey="WIDTH" />}
              stream={formatValue(data.TranscodingInfo ? data.TranscodingInfo.Width : videoStream?.Width)}
              source={formatValue(videoStream?.Width)}
            />
            <DetailRow
              label={<Trans i18nKey="HEIGHT" />}
              stream={formatValue(data.TranscodingInfo ? data.TranscodingInfo.Height : videoStream?.Height)}
              source={formatValue(videoStream?.Height)}
            />
            <DetailRow
              label={<Trans i18nKey="FRAMERATE" />}
              stream={videoStream?.RealFrameRate ? parseFloat(videoStream.RealFrameRate.toFixed(2)) : UNKNOWN_VALUE}
              source={videoStream?.RealFrameRate ? parseFloat(videoStream.RealFrameRate.toFixed(2)) : UNKNOWN_VALUE}
            />
            <DetailRow label={<Trans i18nKey="DYNAMIC_RANGE" />} stream={formatValue(videoStream?.VideoRange)} source={formatValue(videoStream?.VideoRange)} />
            <DetailRow label={<Trans i18nKey="ASPECT_RATIO" />} stream={formatValue(videoStream?.AspectRatio)} source={formatValue(videoStream?.AspectRatio)} />
          </>
        }
      />

      <DetailSection
        title={<Trans i18nKey="AUDIO" />}
        mode={audioMode}
        rows={
          <>
            <DetailRow
              label={<Trans i18nKey="CODEC" />}
              stream={formatUpper(data.TranscodingInfo ? data.TranscodingInfo.AudioCodec : audioStream?.Codec)}
              source={formatUpper(audioStream?.Codec)}
            />
            <DetailRow
              label={<Trans i18nKey="BITRATE" />}
              stream={convertBitrate(data.TranscodingInfo?.IsAudioDirect === false ? data.TranscodingInfo.AudioBitrate : audioStream?.BitRate)}
              source={convertBitrate(audioStream?.BitRate)}
            />
            <DetailRow
              label={<Trans i18nKey="CHANNELS" />}
              stream={formatValue(data.TranscodingInfo?.IsAudioDirect === false ? data.TranscodingInfo.AudioChannels : audioStream?.Channels)}
              source={formatValue(audioStream?.Channels)}
            />
            <DetailRow label={<Trans i18nKey="LANGUAGE" />} stream={formatUpper(audioStream?.Language)} source={formatUpper(audioStream?.Language)} />
          </>
        }
      />

      {transcodeReasons.length > 0 ? (
        <section className="stream-info-section stream-info-reasons">
          <div className="stream-info-section-header">
            <h3>
              <Trans i18nKey="TRANSCODE_REASONS" />
            </h3>
          </div>
          <div className="stream-info-reason-list">
            {transcodeReasons.map((reason) => (
              <span key={reason}>{reason}</span>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function StreamInfo(props) {
  if (!props?.data) {
    return <Loading />;
  }

  return (
    <div className="StreamInfo">
      <StreamDetails data={props.data} />
    </div>
  );
}

export default StreamInfo;
