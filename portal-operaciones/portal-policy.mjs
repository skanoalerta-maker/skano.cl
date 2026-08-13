export const REQUIRED_ROLE = "operations_staff";

export function normalizePlate(value = "") {
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function authorizeOperationsSession(claims, profile) {
  return Boolean(claims?.staff === true && claims?.staff_role === REQUIRED_ROLE
    && profile?.role === REQUIRED_ROLE && profile?.status === "active");
}

export function hasPermission(profile, permission) {
  return profile?.permissions?.[permission] === true;
}

export function visibleSections(profile) {
  return {
    createVehicle: hasPermission(profile, "vehicles_create"),
    deactivateVehicle: hasPermission(profile, "vehicles_deactivate"),
    exportVehicles: hasPermission(profile, "vehicles_export"),
    readRequests: hasPermission(profile, "institutional_requests_read"),
    reviewRequests: hasPermission(profile, "institutional_requests_review"),
  };
}
