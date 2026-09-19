export function formatHoras(ms) {
  const t = Math.round(ms / 60000);
  return `${Math.floor(t / 60)} h ${t % 60} m`;
}

// Estadísticas del período a partir de las fichadas. Solo empleados activos.
export function computarDashboard(fichajes, empleados) {
  const activos = {};
  empleados.forEach((e) => { if (e.activo !== false) activos[e.legajo] = e; });

  const byEmp = {};
  fichajes.forEach((f) => { if (!activos[f.legajo]) return; (byEmp[f.legajo] = byEmp[f.legajo] || []).push(f); });

  let totalTrabajadoMs = 0, totalMinTarde = 0, totalMinTemprano = 0, totalTarde = 0,
      totalEntradas = 0, totalAHorario = 0, totalSalidaAnt = 0;
  const sectorTarde = {};
  const porEmp = {};

  Object.keys(byEmp).forEach((legajo) => {
    const arr = byEmp[legajo].slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const e = activos[legajo];
    let tarde = 0, minTarde = 0, minTemprano = 0, salidaAnt = 0, entradas = 0, trabajadoMs = 0, pend = null;
    arr.forEach((f) => {
      if (f.tipo === "entrada") {
        entradas++;
        if (f.estado === "tarde") { tarde++; if (!f.autorizado) minTarde += Number(f.minutos_tarde) || 0; }
        else if (f.estado === "a_horario") totalAHorario++;
        pend = new Date(f.timestamp);
      } else if (f.tipo === "salida") {
        if (f.estado === "salida_anticipada") { salidaAnt++; if (!f.autorizado) minTemprano += Number(f.minutos_tarde) || 0; }
        if (pend) { trabajadoMs += new Date(f.timestamp) - pend; pend = null; }
      }
    });
    const minDesvio = minTarde + minTemprano;
    porEmp[legajo] = { legajo: Number(legajo), nombre: e.nombre, apellido: e.apellido, sector: e.sector || "—", tarde, minTarde, minTemprano, minDesvio, salidaAnt, entradas, trabajadoMs };
    totalTrabajadoMs += trabajadoMs; totalMinTarde += minTarde; totalMinTemprano += minTemprano;
    totalTarde += tarde; totalEntradas += entradas; totalSalidaAnt += salidaAnt;
    if (tarde > 0) sectorTarde[e.sector || "—"] = (sectorTarde[e.sector || "—"] || 0) + tarde;
  });

  const lista = Object.values(porEmp);
  const masTarde = lista.filter((x) => x.tarde > 0)
    .sort((a, b) => b.tarde - a.tarde || b.minDesvio - a.minDesvio || a.apellido.localeCompare(b.apellido)).slice(0, 20);
  const menosTarde = lista.filter((x) => x.entradas > 0)
    .sort((a, b) => a.tarde - b.tarde || a.minDesvio - b.minDesvio || a.apellido.localeCompare(b.apellido)).slice(0, 20);

  let sectorTop = null;
  Object.entries(sectorTarde).forEach(([s, n]) => { if (!sectorTop || n > sectorTop.n) sectorTop = { sector: s, n }; });

  return {
    totalTrabajadoMs, totalMinTarde, totalMinTemprano, totalMinDesvio: totalMinTarde + totalMinTemprano,
    totalTarde, totalEntradas, puntualidad: totalEntradas ? (totalAHorario / totalEntradas) * 100 : 0,
    totalSalidaAnt, empleadosActivos: Object.keys(activos).length, empleadosTotal: empleados.length,
    sectorTop, masTarde, menosTarde,
  };
}
