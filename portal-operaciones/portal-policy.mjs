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

export function isValidInstitutional(userProfile, officerProfile) {
  return Boolean(
    userProfile?.role === "police" &&
    userProfile?.police_verified === true &&
    userProfile?.institutional_status === "approved" &&
    officerProfile?.status === "active" &&
    officerProfile?.verified === true
  );
}

export function authorizeOperationsSession(
  claims,
  staffProfile,
  adminProfile,
  userProfile,
  officerProfile
) {
  return (
    isValidOperationsStaff(claims, staffProfile) ||
    isValidAdmin(adminProfile) ||
    isValidInstitutional(userProfile, officerProfile)
  );
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
    deactivateSuspicious: hasPermission(
      profile,
      "suspicious_vehicles_deactivate"
    ),
  };
}

export function validatedEvidencePaths(item = {}) {
  const paths = Array.isArray(item.evidence_storage_paths)
    ? item.evidence_storage_paths.filter(
        path => typeof path === "string"
      )
    : [];

  const prefix =
    `institutional_vehicle_submissions/${item.submitted_by_uid}/${item.id}/evidence/`;

  const allowed = new Set(
    [1, 2, 3].map(
      number => `${prefix}photo_${number}.jpg`
    )
  );

  if (
    !paths.length ||
    paths.length > 3 ||
    new Set(paths).size !== paths.length
  ) {
    return [];
  }

  if (paths.some(path => !allowed.has(path))) {
    return [];
  }

  if (item.evidence_count !== paths.length) {
    return [];
  }

  if (item.primary_evidence_storage_path !== paths[0]) {
    return [];
  }

  return paths;
}
/* =========================================================
   TIPOS DE VEHÍCULO Y FORMATOS DE PPU
   Espejo de functions/institutional/plate_format.js (backend).
   El backend vuelve a validar todo: esto solo guía al usuario.
   ========================================================= */

const CURRENT_LETTERS = "BCDFGHJKLPRSTVWXYZ";

export const PLATE_FORMATS = Object.freeze([
  { name: "vehicle_current", label: "Vehículo actual (LLLL·NN)", regex: /^[A-Z]{4}[0-9]{2}$/, currentAlphabet: true },
  { name: "vehicle_legacy", label: "Vehículo antiguo (LL·NNNN)", regex: /^[A-Z]{2}[0-9]{4}$/, currentAlphabet: false },
  { name: "motorcycle_current", label: "Motocicleta actual (LLL·NN)", regex: /^[A-Z]{3}[0-9]{2}$/, currentAlphabet: true },
  { name: "motorcycle_legacy", label: "Motocicleta antigua (LL·NNN)", regex: /^[A-Z]{2}[0-9]{3}$/, currentAlphabet: false },
  { name: "vehicle_future", label: "Vehículo nueva serie 2026 (LLLLL·N)", regex: /^[A-Z]{5}[0-9]$/, currentAlphabet: false },
  { name: "motorcycle_future", label: "Motocicleta nueva serie 2026 (LLLL·N)", regex: /^[A-Z]{4}[0-9]$/, currentAlphabet: false },
  { name: "trailer", label: "Remolque / rampla (LLL·NNN)", regex: /^[A-Z]{3}[0-9]{3}$/, currentAlphabet: false },
]);

const VEHICLE_FORMATS = ["vehicle_current", "vehicle_legacy", "vehicle_future"];
const MOTORCYCLE_FORMATS = ["motorcycle_current", "motorcycle_legacy", "motorcycle_future"];
const TRAILER_FORMATS = [...VEHICLE_FORMATS, "trailer"];

export const VEHICLE_TYPES = Object.freeze([
  { code: "auto", label: "Automóvil / camioneta", formats: VEHICLE_FORMATS },
  { code: "moto", label: "Motocicleta", formats: MOTORCYCLE_FORMATS },
  { code: "camion", label: "Camión", formats: VEHICLE_FORMATS },
  { code: "bus", label: "Bus / minibús", formats: VEHICLE_FORMATS },
  { code: "rampla", label: "Rampla / remolque / semirremolque", formats: TRAILER_FORMATS },
  { code: "tractor", label: "Tractor / maquinaria", formats: TRAILER_FORMATS },
  { code: "otro", label: "Otro", formats: null },
]);

const VEHICLE_TYPE_ALIASES = Object.freeze({
  auto: "auto", automovil: "auto", "automóvil": "auto", camioneta: "auto", station: "auto", jeep: "auto", suv: "auto", furgon: "auto", "furgón": "auto",
  moto: "moto", motocicleta: "moto", motoneta: "moto", scooter: "moto", cuatrimoto: "moto",
  camion: "camion", "camión": "camion", tracto: "camion", tractocamion: "camion", "tractocamión": "camion",
  bus: "bus", minibus: "bus", "minibús": "bus", microbus: "bus", "microbús": "bus",
  rampla: "rampla", remolque: "rampla", semirremolque: "rampla", carro: "rampla",
  tractor: "tractor", maquinaria: "tractor", retroexcavadora: "tractor",
  otro: "otro",
});

export function normalizeVehicleType(value = "") {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "";
  if (VEHICLE_TYPE_ALIASES[raw]) return VEHICLE_TYPE_ALIASES[raw];
  return VEHICLE_TYPE_ALIASES[raw.split(/[\s/,-]+/)[0]] || "";
}

export function vehicleTypeLabel(code) {
  return VEHICLE_TYPES.find(type => type.code === code)?.label || "";
}

export function plateFormats(value) {
  const plate = normalizePlate(value).replace(/CHILE/g, "");
  return PLATE_FORMATS.filter(format => {
    if (!format.regex.test(plate)) return false;
    if (!format.currentAlphabet) return true;
    return [...plate.replace(/[0-9]/g, "")].every(letter => CURRENT_LETTERS.includes(letter));
  });
}

export function isPlateValidForType(value, vehicleType) {
  const formats = plateFormats(value).map(format => format.name);
  if (!formats.length) return false;
  const info = VEHICLE_TYPES.find(type => type.code === vehicleType);
  if (!info || !info.formats) return true;
  return formats.some(name => info.formats.includes(name));
}

// Variantes que solo intercambian O <-> 0. Nunca corrige sola: muestra
// sugerencias para que la persona elija.
export function plateCorrectionCandidates(value, vehicleType = "") {
  const plate = normalizePlate(value).replace(/CHILE/g, "");
  const positions = [...plate].map((char, index) => (char === "O" || char === "0" ? index : -1)).filter(index => index >= 0);
  if (!positions.length || positions.length > 6) return [];

  const result = [];
  for (let mask = 1; mask < (1 << positions.length); mask++) {
    const chars = [...plate];
    let changes = 0;
    positions.forEach((position, bit) => {
      if ((mask >> bit) & 1) {
        chars[position] = chars[position] === "O" ? "0" : "O";
        changes++;
      }
    });
    const candidate = chars.join("");
    if (!plateFormats(candidate).length) continue;
    if (vehicleType && !isPlateValidForType(candidate, vehicleType)) continue;
    result.push({ plate: candidate, changes });
  }
  return result.sort((a, b) => a.changes - b.changes || a.plate.localeCompare(b.plate)).map(item => item.plate);
}

// Mensaje de validación de PPU según tipo (o "" si es válida).
export function plateValidationMessage(value, vehicleType) {
  const plate = normalizePlate(value);
  if (!vehicleType) return "Selecciona el tipo de vehículo.";
  if (isPlateValidForType(plate, vehicleType)) return "";
  const suggestions = plateCorrectionCandidates(plate, vehicleType);
  return suggestions.length
    ? `La PPU ${plate} no coincide con el formato habitual de ${vehicleTypeLabel(vehicleType)}. ¿Quisiste decir ${suggestions.join(" o ")}? (revisa O y 0). Si la patente es correcta, confírmalo.`
    : `La PPU ${plate} no coincide con el formato habitual de ${vehicleTypeLabel(vehicleType)}. Si la patente es correcta (especial, provisoria o nueva serie), confírmalo.`;
}

export function isSuperadmin(profile) {
  return profile?.is_admin === true && profile?.role === "superadmin";
}
