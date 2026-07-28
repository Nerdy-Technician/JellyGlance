#!/usr/bin/env python3
import argparse
import json
import os
import sqlite3
import tempfile
import zipfile
from datetime import datetime, timezone


def open_database(source_path):
    if source_path.lower().endswith(".zip"):
        archive = zipfile.ZipFile(source_path)
        db_names = [name for name in archive.namelist() if name.lower().endswith(".db")]
        if not db_names:
            raise RuntimeError("Zip file does not contain a .db file")

        temp_dir = tempfile.TemporaryDirectory()
        db_name = db_names[0]
        target_path = os.path.join(temp_dir.name, os.path.basename(db_name))
        with archive.open(db_name) as source, open(target_path, "wb") as target:
            target.write(source.read())
        return sqlite3.connect(target_path), temp_dir

    return sqlite3.connect(source_path), None


def iso_from_epoch(value):
    if not value:
        return None
    return datetime.fromtimestamp(int(value), timezone.utc).isoformat()


def prefixed(prefix, value):
    if value in (None, ""):
        return None
    return f"{prefix}:{value}"


def playback_method(row):
    decision = (row["transcode_decision"] or "").lower()
    if "transcode" in decision:
        return "Transcode"
    if "copy" in decision:
        return "DirectStream"
    return "DirectPlay"


def build_media_streams(row):
    streams = []
    if row["video_codec"] or row["video_resolution"]:
        streams.append(
            {
                "Type": "Video",
                "Codec": row["video_codec"],
                "BitRate": row["video_bitrate"] or row["bitrate"],
                "Width": row["video_width"] or row["width"],
                "Height": row["video_height"] or row["height"],
                "DisplayTitle": " ".join(str(value) for value in [row["video_resolution"], row["video_codec"]] if value),
            }
        )
    if row["audio_codec"] or row["audio_channels"]:
        streams.append(
            {
                "Type": "Audio",
                "Codec": row["audio_codec"],
                "BitRate": row["audio_bitrate"],
                "Channels": row["audio_channels"],
                "Language": row["audio_language"],
                "DisplayTitle": " ".join(str(value) for value in [row["audio_codec"], row["audio_channels"]] if value),
            }
        )
    if row["subtitle_codec"] or row["subtitle_language"]:
        streams.append(
            {
                "Type": "Subtitle",
                "Codec": row["subtitle_codec"],
                "Language": row["subtitle_language"],
                "DisplayTitle": " ".join(str(value) for value in [row["subtitle_language"], row["subtitle_codec"]] if value),
            }
        )
    return streams or None


def build_transcoding_info(row):
    decision = (row["transcode_decision"] or "").lower()
    if "transcode" not in decision:
        return None

    return {
        "Container": row["transcode_container"] or row["container"],
        "VideoCodec": row["transcode_video_codec"],
        "AudioCodec": row["transcode_audio_codec"],
        "Bitrate": row["stream_bitrate"] or row["bitrate"],
        "Width": row["transcode_width"],
        "Height": row["transcode_height"],
        "IsVideoDirect": row["video_decision"] == "direct play",
        "IsAudioDirect": row["audio_decision"] == "direct play",
        "Source": "Tautulli",
    }


def map_row(row):
    media_type = row["media_type"] or row["history_media_type"] or ""
    is_episode = media_type.lower() == "episode"
    is_track = media_type.lower() == "track"
    stopped = row["stopped"] or row["started"]
    seconds = max(0, int((row["stopped"] or row["started"] or 0) - (row["started"] or 0) - (row["paused_counter"] or 0)))
    if seconds == 0 and row["view_offset"]:
        seconds = int(row["view_offset"] / 1000)

    item_name = row["title"] or row["full_title"] or f"Tautulli item {row['history_id']}"
    series_name = row["grandparent_title"] if is_episode else None
    parent_key = prefixed("tautulli", row["parent_rating_key"])
    grandparent_key = prefixed("tautulli", row["grandparent_rating_key"])
    item_key = prefixed("tautulli", row["rating_key"])

    return {
        "Id": f"tautulli:{row['history_id']}",
        "IsPaused": False,
        "UserId": prefixed("tautulli-user", row["user_id"]),
        "UserName": row["user"] or "Tautulli User",
        "Client": row["product"] or row["platform"] or "Plex",
        "DeviceName": row["player"] or row["platform"] or "Unknown device",
        "DeviceId": row["machine_id"],
        "ApplicationVersion": row["product_version"],
        "NowPlayingItemId": grandparent_key if is_episode else item_key,
        "NowPlayingItemName": item_name,
        "EpisodeId": item_key if is_episode else None,
        "SeasonId": parent_key if is_episode else None,
        "SeriesName": series_name,
        "PlaybackDuration": seconds,
        "PlayMethod": playback_method(row),
        "ActivityDateInserted": iso_from_epoch(stopped),
        "MediaStreams": build_media_streams(row),
        "TranscodingInfo": build_transcoding_info(row),
        "PlayState": {"IsPaused": False, "PositionTicks": int(row["view_offset"] or 0) * 10000, "PlayMethod": playback_method(row)},
        "OriginalContainer": row["container"],
        "RemoteEndPoint": row["ip_address"],
        "ServerId": "tautulli",
        "imported": True,
        "TautulliMediaType": media_type,
        "TautulliFullTitle": row["full_title"],
        "TautulliGuid": row["guid"],
        "TautulliYear": row["year"],
        "TautulliSeasonNumber": row["parent_media_index"],
        "TautulliEpisodeNumber": row["media_index"],
        "TautulliTrack": is_track,
    }


QUERY = """
SELECT
  h.id AS history_id,
  h.started,
  h.stopped,
  h.rating_key,
  h.user_id,
  h.user,
  h.ip_address,
  h.paused_counter,
  h.player,
  h.product,
  h.product_version,
  h.platform,
  h.machine_id,
  h.media_type AS history_media_type,
  h.parent_rating_key,
  h.grandparent_rating_key,
  h.view_offset,
  m.title,
  m.parent_title,
  m.grandparent_title,
  m.full_title,
  m.media_index,
  m.parent_media_index,
  m.media_type,
  m.year,
  m.duration,
  m.guid,
  mi.video_decision,
  mi.audio_decision,
  mi.transcode_decision,
  mi.container,
  mi.bitrate,
  mi.width,
  mi.height,
  mi.video_bitrate,
  mi.video_codec,
  mi.video_width,
  mi.video_height,
  mi.video_resolution,
  mi.audio_bitrate,
  mi.audio_codec,
  mi.audio_channels,
  mi.audio_language,
  mi.subtitle_codec,
  mi.subtitle_language,
  mi.transcode_container,
  mi.transcode_video_codec,
  mi.transcode_audio_codec,
  mi.transcode_width,
  mi.transcode_height,
  mi.stream_bitrate
FROM session_history h
LEFT JOIN session_history_metadata m ON m.id = h.id
LEFT JOIN session_history_media_info mi ON mi.id = h.id
WHERE h.started IS NOT NULL
ORDER BY h.started ASC
"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument("--summary", action="store_true")
    args = parser.parse_args()

    conn, temp_dir = open_database(args.source)
    conn.row_factory = sqlite3.Row
    try:
      rows = [map_row(row) for row in conn.execute(QUERY)]
      rows = [row for row in rows if row["ActivityDateInserted"] and row["PlaybackDuration"] > 0 and not row["TautulliTrack"]]
      dates = [row["ActivityDateInserted"] for row in rows]
      payload = {
          "sourceFile": args.source,
          "totalRows": len(rows),
          "firstActivityDate": min(dates) if dates else None,
          "lastActivityDate": max(dates) if dates else None,
      }
      if not args.summary:
          payload["rows"] = rows
      print(json.dumps(payload))
    finally:
      conn.close()
      if temp_dir:
          temp_dir.cleanup()


if __name__ == "__main__":
    main()
