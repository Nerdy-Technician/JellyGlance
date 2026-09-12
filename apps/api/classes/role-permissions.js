const PERMISSION_KEYS = ["dashboard", "home", "myGlance", "requests", "downloads", "repair", "users", "settings", "apiKeys"];

const DEFAULT_ACCESS_ROLES = ["Owner", "Admin", "Manager", "Viewer", "Household", "Disabled"];

const DEFAULT_ROLE_PERMISSIONS = {
  Owner: {
    dashboard: true,
    home: true,
    myGlance: true,
    requests: true,
    downloads: true,
    repair: true,
    users: true,
    settings: true,
    apiKeys: true,
  },
  Admin: {
    dashboard: true,
    home: true,
    myGlance: true,
    requests: true,
    downloads: true,
    repair: true,
    users: true,
    settings: true,
    apiKeys: true,
  },
  Manager: {
    dashboard: true,
    home: true,
    myGlance: true,
    requests: true,
    downloads: true,
    repair: false,
    users: true,
    settings: false,
    apiKeys: false,
  },
  Viewer: {
    dashboard: true,
    home: true,
    myGlance: true,
    requests: true,
    downloads: false,
    repair: false,
    users: false,
    settings: false,
    apiKeys: false,
  },
  Household: {
    dashboard: true,
    home: false,
    myGlance: true,
    requests: true,
    downloads: false,
    repair: false,
    users: false,
    settings: false,
    apiKeys: false,
  },
  Disabled: {
    dashboard: false,
    home: false,
    myGlance: false,
    requests: false,
    downloads: false,
    repair: false,
    users: false,
    settings: false,
    apiKeys: false,
  },
};

function normalizeAccessRoles(settings = {}) {
  const roles = [...(settings.roles || DEFAULT_ACCESS_ROLES)];
  if (!roles.includes("Household")) {
    const viewerIndex = roles.indexOf("Viewer");
    if (viewerIndex >= 0) {
      roles.splice(viewerIndex, 0, "Household");
    } else {
      const disabledIndex = roles.indexOf("Disabled");
      if (disabledIndex >= 0) roles.splice(disabledIndex, 0, "Household");
      else roles.push("Household");
    }
  }
  return roles;
}

function getRolePermissions(settings, role) {
  if (role === "Owner" || role === "Disabled") {
    return DEFAULT_ROLE_PERMISSIONS[role];
  }

  return {
    ...(DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.Viewer),
    ...((settings.rolePermissions || {})[role] || {}),
  };
}

function persistRolePermissions(role, permissions = {}, current = {}) {
  const defaults = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.Viewer;
  const next = { ...defaults, ...current };
  for (const key of PERMISSION_KEYS) {
    if (permissions[key] !== undefined) {
      next[key] = Boolean(permissions[key]);
    }
  }
  return next;
}

function mergeRolePermissionMap(stored = {}) {
  const roles = new Set([...Object.keys(DEFAULT_ROLE_PERMISSIONS), ...Object.keys(stored || {})]);
  const next = {};
  for (const role of roles) {
    next[role] = {
      ...(DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.Viewer),
      ...((stored || {})[role] || {}),
    };
  }
  return next;
}

module.exports = {
  PERMISSION_KEYS,
  DEFAULT_ACCESS_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  normalizeAccessRoles,
  getRolePermissions,
  persistRolePermissions,
  mergeRolePermissionMap,
};
