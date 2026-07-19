import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "../lib/axios_instance";
import Config from "../lib/config";
import { slugifyUserName } from "../lib/userProfile";
import Loading from "./components/general/loading";
import UserInfo from "./components/user-info";
import { AccountDashboard, QuickConnectUserWrap } from "./components/home/UserWrapUpDashboard";
import "./css/home-user-wrap.css";

const token = localStorage.getItem("token");

export default function UserProfilePage() {
  const { UserId: userKey = "" } = useParams();
  const [users, setUsers] = useState([]);
  const [access, setAccess] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfileData() {
      try {
        const [configResponse, userResponse, accessResponse] = await Promise.all([
          Config.getConfig(),
          axios.get("/stats/getUserWrapUp", { headers: { Authorization: `Bearer ${token}` } }),
          axios.get("/api/userAccess", { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        setConfig(configResponse);
        setUsers(userResponse.data || []);
        setAccess(accessResponse.data);
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    }

    fetchProfileData();
    const intervalId = setInterval(fetchProfileData, 60000 * 5);
    return () => clearInterval(intervalId);
  }, []);

  const rankedUsers = useMemo(
    () => [...users].sort((a, b) => Number(b.TotalWatchTime || 0) - Number(a.TotalWatchTime || 0)),
    [users]
  );

  const matchedUser = rankedUsers.find((user) => {
    const normalizedKey = decodeURIComponent(userKey).toLowerCase();
    return user.UserId?.toLowerCase?.() === normalizedKey || slugifyUserName(user.UserName) === normalizedKey;
  });

  const rank = matchedUser ? rankedUsers.findIndex((user) => user.UserId === matchedUser.UserId) + 1 : 0;
  const localUsers = access?.localUsers || [];
  const localUser = localUsers.find((user) => slugifyUserName(user.username) === decodeURIComponent(userKey).toLowerCase());

  if (loading) {
    return <Loading />;
  }

  if (matchedUser) {
    return (
      <div className="user-profile-page">
        <QuickConnectUserWrap user={matchedUser} rank={rank || 1} />
      </div>
    );
  }

  if (localUser || ["local", "oidc"].includes(config?.settings?.auth?.mode)) {
    return (
      <div className="user-profile-page">
        <AccountDashboard access={access} />
      </div>
    );
  }

  if (userKey.length > 20) {
    return <UserInfo />;
  }

  return (
    <div className="user-profile-page">
      <section className="user-profile-empty">
        <h1>User not found</h1>
        <p>No JellyGlance profile matched `{decodeURIComponent(userKey)}`.</p>
        <Link to="/users">Back to users</Link>
      </section>
    </div>
  );
}
