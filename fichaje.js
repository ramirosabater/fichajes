// ---------- Utilidades de horario / estado ----------
export function diaISO(d) {
  const dia = d.getDay(); // 0=domingo..6=sábado
  return dia === 0 ? 7 : dia; // 1=lunes..7=domingo
}
function minutosDesdeMedianoche(d) {
  return d.getHours() * 60 + d.getMinutes();
}
function hhmmAMinutos(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
export function bloqueDeHoy(horario, fecha) {
  if (!horario || !horario.bloques) return null;
  const hoy = diaISO(fecha);
  return horario.bloques.find((b) => (b.dias || []).includes(hoy)) || null;
}

// Devuelve estado de la fichada: a_horario | tarde | salida_anticipada | sin_turno
export function calcularEstado(tipo, hora, horario) {
  const bloque = bloqueDeHoy(horario, hora);
  if (!bloque) {
    return { estado: "sin_turno", label: "Sin turno hoy (franco o sin asignar)", color: "#5c6b78", minutosTarde: 0 };
  }
  const tolerancia = horario.tolerancia_minutos ?? 10;
  const min = minutosDesdeMedianoche(hora);
  if (tipo === "entrada") {
    const inicio = hhmmAMinutos(bloque.inicio);
    if (min <= inicio + tolerancia) return { estado: "a_horario", label: "A horario", color: "#16a34a", minutosTarde: 0 };
    return { estado: "tarde", label: `Tarde · +${min - inicio} min`, color: "#e5484d", minutosTarde: min - inicio };
  }
  const fin = hhmmAMinutos(bloque.fin);
  if (min < fin - tolerancia) return { estado: "salida_anticipada", label: `Salida anticipada · -${fin - min} min`, color: "#e1251b", minutosTarde: fin - min };
  return { estado: "a_horario", label: "A horario", color: "#16a34a", minutosTarde: 0 };
}

// ---------- Ubicación ----------
export function distanciaMetros(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function pedirPosicion(opts) {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: Math.round(pos.coords.accuracy || 0) }),
      () => resolve(null),
      opts
    );
  });
}

// Pide GPS preciso; si no responde a tiempo, reintenta con baja precisión (wifi/antena).
export async function obtenerPosicion() {
  if (!navigator.geolocation) return null;
  const precisa = await pedirPosicion({ enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  if (precisa) return precisa;
  return pedirPosicion({ enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 });
}

// Margen extra por imprecisión del GPS (en interiores suele errar 20–80 m). Tope para que no se pueda "estirar" de más.
const MARGEN_GPS_MAX = 75;
function dentroDelRadio(d, local, pos) {
  const radio = local.radio_metros ?? 150;
  const margen = Math.min(pos.precision || 0, MARGEN_GPS_MAX);
  return d <= radio + margen;
}

// Busca el local más cercano dentro de su radio
export function localMasCercano(pos, locales) {
  const e = estadoUbicacion(pos, locales);
  return e.tipo === "dentro" ? { local: e.local, distancia: e.distancia } : { local: null, distancia: e.distancia ?? null };
}

// Evalúa dónde está el empleado: dentro de un depósito, fuera del radio, remoto o sin GPS.
export function estadoUbicacion(pos, locales, asignados) {
  if (!pos) return { tipo: "sin_gps" };
  if (!locales || !locales.length) return { tipo: "remoto" };
  // Normalizar los depósitos asignados a un arreglo de ids (acepta string o array)
  let ids = [];
  if (Array.isArray(asignados)) ids = asignados.filter(Boolean);
  else if (asignados) ids = [asignados];
  // Si el empleado tiene depósitos asignados, se valida contra CUALQUIERA de ellos
  if (ids.length) {
    const suyos = locales.filter((x) => ids.some((id) => String(id) === String(x.id)));
    if (suyos.length) {
      let cerca = null;
      for (const l of suyos) {
        if (l.lat == null || l.lng == null) continue;
        const d = distanciaMetros(pos.lat, pos.lng, Number(l.lat), Number(l.lng));
        if (dentroDelRadio(d, l, pos)) return { tipo: "dentro", local: l, distancia: d };
        if (!cerca || d < cerca.distancia) cerca = { local: l, distancia: d };
      }
      if (cerca) return { tipo: "fuera", local: cerca.local, distancia: cerca.distancia };
    }
  }
  // Sin asignación: el depósito más cercano
  let cerca = null;
  for (const l of locales) {
    if (l.lat == null || l.lng == null) continue;
    const d = distanciaMetros(pos.lat, pos.lng, Number(l.lat), Number(l.lng));
    if (!cerca || d < cerca.distancia) cerca = { local: l, distancia: d };
  }
  if (!cerca) return { tipo: "remoto" };
  const dentro = dentroDelRadio(cerca.distancia, cerca.local, pos);
  return { tipo: dentro ? "dentro" : "fuera", local: cerca.local, distancia: cerca.distancia };
}

// ---------- Dispositivo ----------
export function obtenerDeviceId() {
  try {
    let id = localStorage.getItem("fichaje_device_id");
    if (!id) {
      id = window.crypto?.randomUUID ? crypto.randomUUID() : "dev-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("fichaje_device_id", id);
    }
    return id;
  } catch {
    return "sin-id";
  }
}

// ---------- Período de nómina (21 al 20) ----------
// El período de liquidación es del 1 al último día del mes.
export function calcularPeriodo(ref) {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  return {
    desde: new Date(y, m, 1, 0, 0, 0, 0),
    hasta: new Date(y, m + 1, 0, 23, 59, 59, 999), // día 0 del mes siguiente = último día de este mes
  };
}
export function etiquetaPeriodo(desde, hasta) {
  // Como ahora el período es un mes completo, mostramos el nombre del mes.
  return desde.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}
