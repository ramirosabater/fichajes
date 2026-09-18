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
    return { estado: "sin_turno", label: "Sin turno hoy (franco o sin asignar)", color: "#8b95a5", minutosTarde: 0 };
  }
  const tolerancia = horario.tolerancia_minutos ?? 10;
  const min = minutosDesdeMedianoche(hora);
  if (tipo === "entrada") {
    const inicio = hhmmAMinutos(bloque.inicio);
    if (min <= inicio + tolerancia) return { estado: "a_horario", label: "A horario", color: "#3ddc84", minutosTarde: 0 };
    return { estado: "tarde", label: `Tarde · +${min - inicio} min`, color: "#e5484d", minutosTarde: min - inicio };
  }
  const fin = hhmmAMinutos(bloque.fin);
  if (min < fin - tolerancia) return { estado: "salida_anticipada", label: `Salida anticipada · -${fin - min} min`, color: "#f2a900", minutosTarde: fin - min };
  return { estado: "a_horario", label: "A horario", color: "#3ddc84", minutosTarde: 0 };
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

export function obtenerPosicion() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

// Busca el local más cercano dentro de su radio
export function localMasCercano(pos, locales) {
  if (!pos) return { local: null, distancia: null };
  let mejor = null;
  for (const l of locales) {
    if (l.lat == null || l.lng == null) continue;
    const d = distanciaMetros(pos.lat, pos.lng, Number(l.lat), Number(l.lng));
    if (d <= (l.radio_metros ?? 150) && (!mejor || d < mejor.distancia)) {
      mejor = { local: l, distancia: d };
    }
  }
  return mejor || { local: null, distancia: null };
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
export function calcularPeriodo(ref) {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  return { desde: new Date(y, m - 1, 21, 0, 0, 0, 0), hasta: new Date(y, m, 20, 23, 59, 59, 999) };
}
export function etiquetaPeriodo(desde, hasta) {
  const f = (d) => d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
  return `${f(desde)} al ${f(hasta)}`;
}
