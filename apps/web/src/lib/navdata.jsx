

import HomeFillIcon from 'remixicon-react/HomeFillIcon';
import BarChartFillIcon from 'remixicon-react/BarChartFillIcon';
import HistoryFillIcon from 'remixicon-react/HistoryFillIcon';
import SettingsFillIcon from 'remixicon-react/SettingsFillIcon';
import GalleryFillIcon from 'remixicon-react/GalleryFillIcon';
import UserFillIcon from 'remixicon-react/UserFillIcon';
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
        link: ""
    },
    {
        id: 1,
        icon: <Movie2FillIcon />,
        text: "Recently Added",
        label: "Recently Added",
        link: "recently-added"
    },
    {
        id: 2,
        icon: <GalleryFillIcon />,
        text: <Trans i18nKey="MENU_TABS.LIBRARIES" />,
        label: "Libraries",
        link: "libraries"
    },
    {
        id: 3,
        icon: <UserFillIcon />,
        text: <Trans i18nKey="MENU_TABS.USERS" />,
        label: "Users",
        link: "users"
    },
    {
        id: 4,
        icon: <HistoryFillIcon />,
        text: <Trans i18nKey="MENU_TABS.ACTIVITY" />,
        label: "Activity",
        link: "activity"
    },
    {
        id: 5,
        icon: <CalendarEventFillIcon />,
        text: "Calendar",
        label: "Calendar",
        link: "calendar"
    },
    {
        id: 6,
        icon: <ChatCheckFillIcon />,
        text: "Requests",
        label: "Requests",
        link: "requests"
    },
    {
        id: 7,
        icon: <DownloadCloud2FillIcon />,
        text: "Downloads",
        label: "Downloads",
        link: "downloads"
    },
    {
        id: 8,
        icon: <CpuFillIcon />,
        text: "Active Transcodes",
        label: "Active Transcodes",
        link: "active-transcodes"
    },
    {
        id: 9,
        icon: <UserAddFillIcon />,
        text: "Invites",
        label: "Invites",
        link: "wizarr"
    },
    {
        id: 10,
        icon: <Database2LineIcon />,
        text: "Maintainerr",
        label: "Maintainerr",
        link: "maintainerr"
    },
    {
        id: 11,
        icon: <RadarFillIcon />,
        text: "Automation Health",
        label: "Automation Health",
        link: "automation-health"
    },
    {
        id: 12,
        icon: <BarChartFillIcon />,
        text: <Trans i18nKey="MENU_TABS.STATISTICS" />,
        label: "Statistics",
        link: "statistics"
    },

    {
        id: 13,
        icon: <ServerFillIcon />,
        text: <Trans i18nKey="MENU_TABS.JELLYFIN_JOBS" />,
        label: "Jellyfin Jobs",
        link: "server-management"
    },
    {
        id: 14,
        icon: <SettingsFillIcon />,
        text: <Trans i18nKey="MENU_TABS.SETTINGS" />,
        label: "Settings",
        link: "settings"
    }
    ,

    {
        id: 15,
        icon: <InformationFillIcon />,
        text: <Trans i18nKey="MENU_TABS.ABOUT" />,
        label: "About",
        link: "about"
    }

]
