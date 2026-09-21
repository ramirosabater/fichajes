import { SUPABASE_URL, SUPABASE_KEY } from "../lib/supabase.js";

let AUTH_TOKEN = null;
let REFRESH_TOKEN = null;
let ADMIN_EMAIL = null;

const authHeader = () => `Bearer ${AUTH_TOKEN || SUPABASE_KEY}`;

export async function loginAdmin(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Credenciales inválidas");
  const d = await res.json();
  AUTH_TOKEN = d.access_token;
  REFRESH_TOKEN = d.refresh_token || null;
  ADMIN_EMAIL = d.user?.email || email;
  return d;
}

export function logoutAdmin() { AUTH_TOKEN = null; REFRESH_TOKEN = null; }
export function getAdminEmail() { return ADMIN_EMAIL; }

async function refrescar() {
  if (!REFRESH_TOKEN) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: REFRESH_TOKEN }),
    });
    if (!res.ok) return false;
    const d = await res.json();
    if (d.access_token) { AUTH_TOKEN = d.access_token; REFRESH_TOKEN = d.refresh_token || REFRESH_TOKEN; return true; }
    return false;
  } catch { return false; }
}

async function sbFetch(path, options = {}) {
  const hacer = () => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: SUPABASE_KEY, Authorization: authHeader(), ...(options.headers || {}) },
  });
  let res = await hacer();
  if ((res.status === 401 || res.status === 403) && AUTH_TOKEN) {
    if (await refrescar()) res = await hacer();
    else {
      AUTH_TOKEN = null; REFRESH_TOKEN = null;
      alert("Tu sesión expiró. Volvé a iniciar sesión.");
      location.reload();
      throw new Error("Sesión expirada");
    }
  }
  return res;
}

export async function sbGet(path) {
  const res = await sbFetch(path);
  if (!res.ok) throw new Error(`Error consultando ${path}: ${res.status}`);
  return res.json();
}
export async function sbPatch(path, body) {
  const res = await sbFetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Error actualizando ${path}: ${res.status}`);
  return res.json();
}
export async function sbPost(path, body) {
  const res = await sbFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Error guardando en ${path}: ${res.status}`);
  return res.json();
}
export async function sbDelete(path) {
  const res = await sbFetch(path, { method: "DELETE" });
  if (!res.ok) throw new Error(`Error borrando ${path}: ${res.status}`);
  return true;
}
export async function sbRpc(fn, body) {
  const res = await sbFetch(`rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Error RPC ${fn}: ${res.status}`);
  return res.json();
}

// Registra una acción en la auditoría (no bloquea si falla)
export async function registrarAuditoria(accion, detalle) {
  try {
    await sbFetch("auditoria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quien: ADMIN_EMAIL || "admin", accion, detalle: detalle || null }),
    });
  } catch { /* la auditoría no debe romper la acción principal */ }
}
