import { etiquetaPeriodo } from "./fichaje.js";

// Minutos de un intervalo trabajado que caen "al 100%" (sáb 13:00 → dom 24:00).
export function minutos100(s, e) {
  let total = 0;
  let cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  while (cur < e) {
    const next = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    const dow = cur.getDay(); // 0=dom, 6=sáb
    let winStart = null, winEnd = null;
    if (dow === 6) { winStart = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 13, 0); winEnd = next; }
    else if (dow === 0) { winStart = cur; winEnd = next; }
    if (winStart) {
      const a = Math.max(s.getTime(), winStart.getTime());
      const b = Math.min(e.getTime(), winEnd.getTime());
      if (b > a) total += (b - a) / 60000;
    }
    cur = next;
  }
  return total;
}

export function minAHoras(min) {
  const t = Math.round(min);
  return `${Math.floor(t / 60)}h ${t % 60}m`;
}

// Cumplimiento de un empleado en el período: días esperados (según su horario),
// días sin registro/entrada/salida, minutos tarde/retiro (descuento) y horas al 100%.
// Los días futuros no se cuentan como faltantes.
export function computarCumplimiento(fichajes, horario, desde, hasta) {
  const res = {
    sinTurno: !horario || !horario.bloques || horario.bloques.length === 0,
    diasEsperados: 0, diasTrabajados: 0, sinRegistro: 0, sinEntrada: 0, sinSalida: 0,
    minTarde: 0, minRetiro: 0, descuentoMin: 0, horas100Min: 0,
  };
  fichajes.forEach((f) => {
    if (f.estado === "tarde") res.minTarde += Number(f.minutos_tarde) || 0;
    else if (f.estado === "salida_anticipada") res.minRetiro += Number(f.minutos_tarde) || 0;
  });
  res.descuentoMin = res.minTarde + res.minRetiro;

  const orden = fichajes.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  let pend = null;
  orden.forEach((f) => {
    if (f.tipo === "entrada") pend = new Date(f.timestamp);
    else if (f.tipo === "salida" && pend) { res.horas100Min += minutos100(pend, new Date(f.timestamp)); pend = null; }
  });

  if (!res.sinTurno) {
    const dias = new Set();
    horario.bloques.forEach((b) => (b.dias || []).forEach((d) => dias.add(d)));
    const porFecha = {};
    fichajes.forEach((f) => {
      const d = new Date(f.timestamp);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const reg = (porFecha[key] = porFecha[key] || { entrada: false, salida: false });
      if (f.tipo === "entrada") reg.entrada = true;
      if (f.tipo === "salida") reg.salida = true;
    });
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const cur = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
    const fin = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
    while (cur <= fin) {
      if (cur <= hoy) {
        const iso = cur.getDay() === 0 ? 7 : cur.getDay();
        if (dias.has(iso)) {
          res.diasEsperados++;
          const key = `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`;
          const reg = porFecha[key];
          if (!reg) res.sinRegistro++;
          else {
            if (reg.entrada && reg.salida) res.diasTrabajados++;
            if (!reg.entrada) res.sinEntrada++;
            if (!reg.salida) res.sinSalida++;
          }
        }
      }
      cur.setDate(cur.getDate() + 1);
    }
  }
  return res;
}

// Texto automático de incumplimientos para el motivo de una observación.
export function textoIncumplimientos(equipoCumpl, desde, hasta) {
  const lineas = [];
  equipoCumpl.forEach((m) => {
    const c = m.cumpl;
    const partes = [];
    if (c.sinRegistro > 0) partes.push(`${c.sinRegistro} día(s) sin registro`);
    if (c.sinEntrada > 0) partes.push(`${c.sinEntrada} sin entrada`);
    if (c.sinSalida > 0) partes.push(`${c.sinSalida} sin salida`);
    if (c.minTarde > 0) partes.push(`${c.minTarde} min tarde`);
    if (c.minRetiro > 0) partes.push(`${c.minRetiro} min retiro`);
    if (partes.length) lineas.push(`• ${m.apellido}, ${m.nombre}: ${partes.join(", ")} (descuento ${c.descuentoMin} min)`);
  });
  if (!lineas.length) return `Período ${etiquetaPeriodo(desde, hasta)} — sin incumplimientos detectados.`;
  return `Período ${etiquetaPeriodo(desde, hasta)} — incumplimientos:\n` + lineas.join("\n");
}
