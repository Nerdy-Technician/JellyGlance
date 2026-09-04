

import HomeFillIcon from 'remixicon-react/HomeFillIcon';
import BarChartFillIcon from 'remixicon-react/BarChartFillIcon';
import HistoryFillIcon from 'remixicon-react/HistoryFillIcon';
import TimeFillIcon from 'remixicon-react/TimeFillIcon';
import SettingsFillIcon from 'remixicon-react/SettingsFillIcon';
import GalleryFillIcon from 'remixicon-react/GalleryFillIcon';
import UserFillIcon from 'remixicon-react/UserFillIcon';
import UserStarFillIcon from 'remixicon-react/UserStarFillIcon';
import InformationFillIcon from 'remixicon-react/InformationFillIcon';
import Movie2FillIcon from 'remixicon-react/Movie2FillIcon';
import CalendarEventFillIcon from 'remixicon-react/CalendarEventFillIcon';
import ChatCheckFillIcon from 'remixicon-react/ChatCheckFillIcon';
import DownloadCloud2FillIcon from 'remixicon-react/DownloadCloud2FillIcon';
import ServerFillIcon from 'remixicon-react/ServerFillIcon';
import UserAddFillIcon from 'remixicon-react/UserAddFillIcon';
import CpuFillIcon from 'remixicon-react/CpuFillIcon';
import Database2LineIcon from 'remixicon-react/Database2LineIcon';
import RadarFillIcon from 'remixicon-react/RadarFillIcon';
import { Trans } from 'react-i18next';


export const navData = [
    {
        id: 0,
        icon: <HomeFillIcon/>,
        text: <Trans i18nKey="MENU_TABS.HOME" />,
        label: "Home",
        i18nKey: "MENU_TABS.HOME",
        link: ""
    },
    {
        id: 1,
        icon: <Movie2FillIcon />,
        text: <Trans i18nKey="MENU_TABS.RECENTLY_ADDED" />,
        label: "Recently Added",
        i18nKey: "MENU_TABS.RECENTLY_ADDED",
        link: "recently-added"
    },
    {
        id: 2,
        icon: <GalleryFillIcon />,
        text: <Trans i18nKey="MENU_TABS.LIBRARIES" />,
        label: "Libraries",
        i18nKey: "MENU_TABS.LIBRARIES",
        link: "libraries"
    },
    {
        id: 3,
        icon: <UserFillIcon />,
        text: <Trans i18nKey="MENU_TABS.USERS" />,
        label: "Users",
        i18nKey: "MENU_TABS.USERS",
        link: "users"
    },
    {
        id: 4,
        icon: <HistoryFillIcon />,
        text: <Trans i18nKey="MENU_TABS.ACTIVITY" />,
        label: "Activity",
        i18nKey: "MENU_TABS.ACTIVITY",
        link: "activity"
    },
    {
        id: 16,
        icon: <TimeFillIcon />,
        text: <Trans i18nKey="MENU_TABS.TIMELINE" />,
        label: "Timeline",
        i18nKey: "MENU_TABS.TIMELINE",
        link: "timeline"
    },
    {
        id: 5,
        icon: <CalendarEventFillIcon />,
        text: <Trans i18nKey="MENU_TABS.CALENDAR" />,
        label: "Calendar",
        i18nKey: "MENU_TABS.CALENDAR",
        link: "calendar"
    },
    {
        id: 6,
        icon: <ChatCheckFillIcon />,
        text: <Trans i18nKey="MENU_TABS.REQUESTS" />,
        label: "Requests",
        i18nKey: "MENU_TABS.REQUESTS",
        link: "requests"
    },
    {
        id: 7,
        icon: <DownloadCloud2FillIcon />,
        text: <Trans i18nKey="MENU_TABS.DOWNLOADS" />,
        label: "Downloads",
        i18nKey: "MENU_TABS.DOWNLOADS",
        link: "downloads"
    },
    {
        id: 8,
        icon: <CpuFillIcon />,
        text: <Trans i18nKey="MENU_TABS.ACTIVE_TRANSCODES" />,
        label: "Active Transcodes",
        i18nKey: "MENU_TABS.ACTIVE_TRANSCODES",
        link: "active-transcodes"
    },
    {
        id: 9,
        icon: <UserAddFillIcon />,
        text: <Trans i18nKey="MENU_TABS.INVITES" />,
        label: "Invites",
        i18nKey: "MENU_TABS.INVITES",
        link: "wizarr"
    },
    {
        id: 10,
        icon: <Database2LineIcon />,
        text: <Trans i18nKey="MENU_TABS.MAINTAINERR" />,
        label: "Maintainerr",
        i18nKey: "MENU_TABS.MAINTAINERR",
        link: "maintainerr"
    },
    {
        id: 11,
        icon: <RadarFillIcon />,
        text: <Trans i18nKey="MENU_TABS.AUTOMATION_HEALTH" />,
        label: "Automation Health",
        i18nKey: "MENU_TABS.AUTOMATION_HEALTH",
        link: "automation-health"
    },
    {
        id: 12,
        icon: <BarChartFillIcon />,
        text: <Trans i18nKey="MENU_TABS.STATISTICS" />,
        label: "Statistics",
        i18nKey: "MENU_TABS.STATISTICS",
        link: "statistics"
    },

    {
        id: 13,
        icon: <ServerFillIcon />,
        text: <Trans i18nKey="MENU_TABS.JELLYFIN_JOBS" />,
        label: "Jellyfin Jobs",
        i18nKey: "MENU_TABS.JELLYFIN_JOBS",
        link: "server-management"
    },
    {
        id: 17,
        icon: <UserStarFillIcon />,
        text: <Trans i18nKey="MENU_TABS.MY_GLANCE" />,
        label: "My Glance",
        i18nKey: "MENU_TABS.MY_GLANCE",
        link: "me"
    },
    {
        id: 14,
        icon: <SettingsFillIcon />,
        text: <Trans i18nKey="MENU_TABS.SETTINGS" />,
        label: "Settings",
        i18nKey: "MENU_TABS.SETTINGS",
        link: "settings"
    },

    {
        id: 15,
        icon: <InformationFillIcon />,
        text: <Trans i18nKey="MENU_TABS.ABOUT" />,
        label: "About",
        i18nKey: "MENU_TABS.ABOUT",
        link: "about"
    }

]
