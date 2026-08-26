export const REQUIRED_ROLE = "operations_staff";

export function normalizePlate(value = "") {
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidOperationsStaff(claims, profile) {
  return Boolean(
    claims?.staff === true &&
    claims?.staff_role === REQUIRED_ROLE &&
    profile?.role === REQUIRED_ROLE &&
    profile?.status === "active"
  );
}

export function isValidAdmin(adminProfile) {
  return Boolean(
    adminProfile?.active === true &&
    ["admin", "superadmin"].includes(adminProfile?.role)
  );
}

export function authorizeOperationsSession(claims, staffProfile, adminProfile) {
  return isValidOperationsStaff(claims, staffProfile) ||
    isValidAdmin(adminProfile);
}

export function hasPermission(profile, permission) {
  if (profile?.is_admin === true) {
    return true;
  }

  return profile?.permissions?.[permission] === true;
}

export function visibleSections(profile) {
  return {
    createVehicle: hasPermission(profile, "vehicles_create"),
    deactivateVehicle: hasPermission(profile, "vehicles_deactivate"),
    exportVehicles: hasPermission(profile, "vehicles_export"),
    readRequests: hasPermission(profile, "institutional_requests_read"),
    reviewRequests: hasPermission(profile, "institutional_requests_review"),
    readSuspicious: hasPermission(profile, "suspicious_vehicles_read"),
    createSuspicious: hasPermission(profile, "suspicious_vehicles_create"),
    reviewSuspicious: hasPermission(profile, "suspicious_vehicles_review"),
    deactivateSuspicious: hasPermission(profile, "suspicious_vehicles_deactivate"),
  };
}

export function validatedEvidencePaths(item = {}) {
  const paths = Array.isArray(item.evidence_storage_paths)
    ? item.evidence_storage_paths.filter(path => typeof path === "string")
    : [];
  const prefix = `institutional_vehicle_submissions/${item.submitted_by_uid}/${item.id}/evidence/`;
  const allowed = new Set([1, 2, 3].map(number => `${prefix}photo_${number}.jpg`));
  if (!paths.length || paths.length > 3 || new Set(paths).size !== paths.length) return [];
  if (paths.some(path => !allowed.has(path))) return [];
  if (item.evidence_count !== paths.length) return [];
  if (item.primary_evidence_storage_path !== paths[0]) return [];
  return paths;
}
