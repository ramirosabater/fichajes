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
// Todos los bloques (tramos) del día, ordenados por hora de inicio.
// Un turno partido tiene 2 o más bloques el mismo día (ej. 08-12 y 16-20).
export function bloquesDeHoy(horario, fecha) {
  if (!horario || !horario.bloques) return [];
  const hoy = diaISO(fecha);
  return horario.bloques
    .filter((b) => (b.dias || []).includes(hoy) && b.inicio && b.fin)
    .sort((a, b) => hhmmAMinutos(a.inicio) - hhmmAMinutos(b.inicio));
}
// Compatibilidad: primer bloque del día.
export function bloqueDeHoy(horario, fecha) {
  return bloquesDeHoy(horario, fecha)[0] || null;
}

// Elige el tramo al que corresponde una fichada:
// - entrada → el tramo cuyo INICIO está más cerca de la hora fichada
// - salida  → el tramo cuyo FIN está más cerca de la hora fichada
// Así, la vuelta del corte (ej. 15:55) se compara con las 16:00 y no con las 08:00.
function tramoParaFichada(bloques, tipo, min) {
  let mejor = null, dist = Infinity;
  for (const b of bloques) {
    const ref = hhmmAMinutos(tipo === "entrada" ? b.inicio : b.fin);
    const d = Math.abs(min - ref);
    if (d < dist) { dist = d; mejor = b; }
  }
  return mejor;
}

// Devuelve estado de la fichada: a_horario | tarde | salida_anticipada | sin_turno
export function esHorarioLibre(horario) {
  return !!horario && horario.tipo === "libre";
}

export function calcularEstado(tipo, hora, horario) {
  // Horario libre: no hay hora de entrada/salida fija, solo se cuentan las horas trabajadas.
  if (esHorarioLibre(horario)) {
    return { estado: "a_horario", label: "Horario libre", color: "#16a34a", minutosTarde: 0 };
  }
  const bloques = bloquesDeHoy(horario, hora);
  if (!bloques.length) {
    return { estado: "sin_turno", label: "Sin turno hoy (franco o sin asignar)", color: "#5c6b78", minutosTarde: 0 };
  }
  const tolerancia = horario.tolerancia_minutos ?? 10;
  const min = minutosDesdeMedianoche(hora);
  const bloque = tramoParaFichada(bloques, tipo, min);
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
        if (d <= (l.radio_metros ?? 150)) return { tipo: "dentro", local: l, distancia: d };
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
  const dentro = cerca.distancia <= (cerca.local.radio_metros ?? 150);
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
