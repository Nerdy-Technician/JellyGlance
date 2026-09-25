import { lazy } from "react";
import UserLineIcon from "remixicon-react/UserLineIcon";
import UserAddLineIcon from "remixicon-react/UserAddLineIcon";
import PageTabs, { readAuth, readNavAvailability } from "./components/general/PageTabs";

const Users = lazy(() => import("./users"));
const Wizarr = lazy(() => import("./wizarr"));

export default function UsersHub() {
  const { permissions } = readAuth();
  const tabs = [
    { id: "users", label: "Users", icon: UserLineIcon, visible: Boolean(permissions.users), render: () => <Users /> },
    { id: "invites", label: "Invites", icon: UserAddLineIcon, visible: readNavAvailability("jellyglance_wizarr_nav_available"), render: () => <Wizarr /> },
  ];
  return <PageTabs title="Users" tabs={tabs} />;
}
