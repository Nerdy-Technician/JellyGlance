const { randomUUID } = require("crypto");

const ALLOWED_LOCAL_ROLES = new Set(["Owner", "Admin", "Manager", "Viewer", "Disabled"]);

function normalizeLocalUsers(users = []) {
  if (!Array.isArray(users)) {
    return [];
  }

  const seenIds = new Set();
  const seenUsernames = new Set();

  return users
    .map((user) => {
      if (!user || typeof user !== "object") {
        return null;
      }

      const cleanUsername = String(user.username || "").trim();
      if (!cleanUsername) {
        return null;
      }

      const baseUser = {
        ...user,
        username: cleanUsername,
        role: ALLOWED_LOCAL_ROLES.has(user.role) ? user.role : "Viewer",
        password: String(user.password || ""),
        createdAt: user.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      let id = String(user.id || "").trim();
      while (!id || seenIds.has(id)) {
        id = randomUUID();
      }

      seenIds.add(id);
      seenUsernames.add(cleanUsername);

      return {
        ...baseUser,
        id,
      };
    })
    .filter(Boolean)
    .filter((user, index, list) => {
      if (seenUsernames.has(user.username) && list.findIndex((item) => item.username === user.username) !== index) {
        return false;
      }

      return true;
    });
}

exports.up = async function (knex) {
  const rows = await knex.select("ID", "APP_USER", "APP_PASSWORD", "settings").from("app_config");

  for (const row of rows) {
    const settings = row.settings || {};
    let localUsers = normalizeLocalUsers(settings.localUsers || []);
    let changed = Array.isArray(settings.localUsers)
      ? localUsers.length !== settings.localUsers.length
      : settings.localUsers !== undefined;

    const isQuickOrOidc = ["jellyfin-quick-connect", "oidc", "local-auth"].includes(row.APP_USER);
    const hasPrimaryCredentials = Boolean(row.APP_USER && row.APP_PASSWORD);

    if (!localUsers.length && hasPrimaryCredentials && !isQuickOrOidc) {
      const existingOwner = localUsers.find((user) => user.role === "Owner");
      if (!existingOwner) {
        localUsers = [
          ...localUsers,
          {
            id: randomUUID(),
            username: String(row.APP_USER),
            password: String(row.APP_PASSWORD),
            role: "Owner",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
        changed = true;
      }
    }

    if (!changed) {
      const maybeSanitizedUsers = normalizeLocalUsers(localUsers);
      if (JSON.stringify(maybeSanitizedUsers) !== JSON.stringify(localUsers)) {
        changed = true;
        localUsers = maybeSanitizedUsers;
      }
    }

    if (changed || !settings.localUsers) {
      await knex("app_config").where({ ID: row.ID }).update({ settings: { ...settings, localUsers } });
    }
  }
};

exports.down = async function (knex) {
  await Promise.resolve();
};
