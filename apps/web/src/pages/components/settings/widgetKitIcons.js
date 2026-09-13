import AddBoxLineIcon from "remixicon-react/AddBoxLineIcon";
import AlarmWarningLineIcon from "remixicon-react/AlarmWarningLineIcon";
import AppsLineIcon from "remixicon-react/AppsLineIcon";
import ArchiveLineIcon from "remixicon-react/ArchiveLineIcon";
import BarChartGroupedLineIcon from "remixicon-react/BarChartGroupedLineIcon";
import CalendarEventLineIcon from "remixicon-react/CalendarEventLineIcon";
import CalendarLineIcon from "remixicon-react/CalendarLineIcon";
import ChatCheckLineIcon from "remixicon-react/ChatCheckLineIcon";
import CodeSSlashLineIcon from "remixicon-react/CodeSSlashLineIcon";
import ComputerLineIcon from "remixicon-react/ComputerLineIcon";
import CpuLineIcon from "remixicon-react/CpuLineIcon";
import Database2LineIcon from "remixicon-react/Database2LineIcon";
import DeleteBin2LineIcon from "remixicon-react/DeleteBin2LineIcon";
import DownloadCloud2LineIcon from "remixicon-react/DownloadCloud2LineIcon";
import ErrorWarningLineIcon from "remixicon-react/ErrorWarningLineIcon";
import EyeLineIcon from "remixicon-react/EyeLineIcon";
import FileCodeLineIcon from "remixicon-react/FileCodeLineIcon";
import FilmLineIcon from "remixicon-react/FilmLineIcon";
import FlagLineIcon from "remixicon-react/FlagLineIcon";
import Folder2LineIcon from "remixicon-react/Folder2LineIcon";
import GridLineIcon from "remixicon-react/GridLineIcon";
import GroupLineIcon from "remixicon-react/GroupLineIcon";
import HammerLineIcon from "remixicon-react/HammerLineIcon";
import HardDrive2LineIcon from "remixicon-react/HardDrive2LineIcon";
import HeartPulseLineIcon from "remixicon-react/HeartPulseLineIcon";
import HistoryLineIcon from "remixicon-react/HistoryLineIcon";
import ImageLineIcon from "remixicon-react/ImageLineIcon";
import LinksLineIcon from "remixicon-react/LinksLineIcon";
import ListCheck2Icon from "remixicon-react/ListCheck2Icon";
import MailLineIcon from "remixicon-react/MailLineIcon";
import Notification3LineIcon from "remixicon-react/Notification3LineIcon";
import PlayCircleLineIcon from "remixicon-react/PlayCircleLineIcon";
import Plug2LineIcon from "remixicon-react/Plug2LineIcon";
import PulseLineIcon from "remixicon-react/PulseLineIcon";
import RadarLineIcon from "remixicon-react/RadarLineIcon";
import ServerLineIcon from "remixicon-react/ServerLineIcon";
import TaskLineIcon from "remixicon-react/TaskLineIcon";
import TerminalBoxLineIcon from "remixicon-react/TerminalBoxLineIcon";
import TimeLineIcon from "remixicon-react/TimeLineIcon";
import TimerLineIcon from "remixicon-react/TimerLineIcon";
import UserAddLineIcon from "remixicon-react/UserAddLineIcon";

export const WIDGET_GROUP_ICONS = {
  All: AppsLineIcon,
  Overview: GridLineIcon,
  Playback: PlayCircleLineIcon,
  Library: Database2LineIcon,
  Queue: DownloadCloud2LineIcon,
  Calendar: CalendarLineIcon,
  Integrations: Plug2LineIcon,
  Ops: HeartPulseLineIcon,
  Kit: FileCodeLineIcon,
};

const WIDGET_FILE_ICONS = {
  overview: GridLineIcon,
  catalog: FilmLineIcon,
  storage: HardDrive2LineIcon,
  sessions: PulseLineIcon,
  nowplaying: PlayCircleLineIcon,
  viewers: EyeLineIcon,
  users: GroupLineIcon,
  activity: HistoryLineIcon,
  watch: TimeLineIcon,
  statistics: BarChartGroupedLineIcon,
  libraries: Folder2LineIcon,
  repair: HammerLineIcon,
  recent: AddBoxLineIcon,
  item: ImageLineIcon,
  downloads: DownloadCloud2LineIcon,
  stalled: ErrorWarningLineIcon,
  queue: ListCheck2Icon,
  stitched: LinksLineIcon,
  calendar: CalendarLineIcon,
  today: CalendarEventLineIcon,
  requests: ChatCheckLineIcon,
  issues: FlagLineIcon,
  invites: UserAddLineIcon,
  autobrr: RadarLineIcon,
  transcodes: CpuLineIcon,
  maintainerr: DeleteBin2LineIcon,
  automation: Plug2LineIcon,
  devices: ComputerLineIcon,
  health: HeartPulseLineIcon,
  digest: AlarmWarningLineIcon,
  jellyfin: ServerLineIcon,
  backup: ArchiveLineIcon,
  webhooks: Notification3LineIcon,
  jobs: TaskLineIcon,
  "jellyfin-jobs": TimerLineIcon,
  newsletter: MailLineIcon,
  homepage: FileCodeLineIcon,
  curl: TerminalBoxLineIcon,
};

const PATH_ALIASES = {
  "ops-digest": "digest",
  "library-storage": "storage",
  "item-glance": "item",
  status: "jellyfin",
};

export function widgetGroupIcon(name) {
  return WIDGET_GROUP_ICONS[name] || AppsLineIcon;
}

export function widgetFileIcon(id) {
  return WIDGET_FILE_ICONS[id] || CodeSSlashLineIcon;
}

export function widgetPathIcon(path) {
  const parts = String(path || "")
    .split("/")
    .filter((part) => part && !part.startsWith(":"));

  for (const part of [...parts].reverse()) {
    const id = PATH_ALIASES[part] || part;
    if (WIDGET_FILE_ICONS[id]) return WIDGET_FILE_ICONS[id];
  }

  return CodeSSlashLineIcon;
}
