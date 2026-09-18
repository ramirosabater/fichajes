import { useState, useEffect } from "react";
import { sbGet } from "./supabase-admin.js";
import { calcularPeriodo, etiquetaPeriodo } from "../lib/fichaje.js";
import { computarCumplimiento, cargarConfig } from "../lib/cumplimiento.js";
import { generarXlsx, descargarBytes } from "./xlsx.js";

export default function Reportes() {
  const [alcance, setAlcance] = useState("todos"); // todos | sector | empleado
  const [sector, setSector] = useState("");
  const [legajo, setLegajo] = useState("");
  const [refMes, setRefMes] = useState(new Date());
  const [datos, setDatos] = useState({ sectores: [], empleados: [] });
  const [config, setConfig] = useState({ recargos: [], feriados: {} });
  const [bajando, setBajando] = useState("");
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);

  // cargar sectores y empleados para los selectores
  useEffect(() => {
    (async () => {
      try {
        const emps = await sbGet("empleados?select=legajo,apellido,nombre,sector,horario_id,activo&order=apellido.asc");
        let secs = [];
        try { secs = (await sbGet("sectores?select=nombre&order=nombre.asc")).map((s) => s.nombre); }
        catch { secs = [...new Set(emps.map((e) => e.sector).filter(Boolean))].sort(); }
        setDatos({ sectores: secs, empleados: emps });
        setConfig(await cargarConfig(sbGet));
      } catch { /* ignore */ }
    })();
  }, []);

  async function traerFichajes(desde, hasta, filtroLegajo) {
    let q = `fichajes?timestamp=gte.${desde.toISOString()}&timestamp=lte.${hasta.toISOString()}&order=timestamp.asc&limit=200000`;
    if (filtroLegajo) q += `&legajo=eq.${filtroLegajo}`;
    return sbGet(q);
  }

  const descargarDetalle = async () => {
    setError(null); setOk(null);
    if (alcance === "empleado" && !legajo) return setError("Elegí un empleado.");
    if (alcance === "sector" && !sector) return setError("Elegí un sector.");
    setBajando("detalle");
    try {
      const { desde, hasta } = calcularPeriodo(refMes);
      const [fichajes, locales] = await Promise.all([
        traerFichajes(desde, hasta, alcance === "empleado" ? legajo : null),
        sbGet("locales?select=*"),
      ]);
      const mapEmp = {}; datos.empleados.forEach((e) => (mapEmp[e.legajo] = e));
      const mapLoc = {}; locales.forEach((l) => (mapLoc[l.id] = l.nombre));
      let filas = fichajes.filter((f) => (mapEmp[f.legajo] || {}).activo !== false);
      if (alcance === "sector") filas = filas.filter((f) => (mapEmp[f.legajo] || {}).sector === sector);
      if (!filas.length) { setError("No hay fichadas para ese filtro."); setBajando(""); return; }
      const headers = ["Legajo", "Apellido y Nombre", "Sector", "Fecha", "Hora", "Día", "Tipo", "Estado", "Ubicación", "Distancia (m)"];
      const rows = filas.map((f) => {
        const e = mapEmp[f.legajo] || {}, d = new Date(f.timestamp);
        return [f.legajo, e.apellido ? `${e.apellido}, ${e.nombre}` : "(desconocido)", e.sector || "",
          d.toLocaleDateString("es-AR"), d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
          d.toLocaleDateString("es-AR", { weekday: "long" }), f.tipo || "", f.estado || "",
          f.local_id ? (mapLoc[f.local_id] || f.local_id) : "Remoto", f.distancia_metros == null ? "" : Number(f.distancia_metros)];
      });
      descargarBytes(generarXlsx(headers, rows), `fichadas_${desde.toISOString().slice(0, 10)}_a_${hasta.toISOString().slice(0, 10)}.xlsx`);
      setOk(`Reporte generado: ${rows.length} fichadas.`);
    } catch { setError("No se pudo generar el reporte."); }
    finally { setBajando(""); }
  };

  const descargarResumen = async () => {
    setError(null); setOk(null);
    setBajando("resumen");
    try {
      const { desde, hasta } = calcularPeriodo(refMes);
      const [fichajes, horarios] = await Promise.all([traerFichajes(desde, hasta, null), sbGet("horarios?select=*")]);
      const porEmp = {}; fichajes.forEach((f) => (porEmp[f.legajo] = porEmp[f.legajo] || []).push(f));
      const mapHor = {}; horarios.forEach((h) => (mapHor[h.id] = h));
      let lista = datos.empleados.filter((e) => e.activo !== false);
      if (alcance === "sector" && sector) lista = lista.filter((e) => e.sector === sector);
      if (alcance === "empleado" && legajo) lista = lista.filter((e) => String(e.legajo) === String(legajo));
      const headers = ["Legajo", "Empleado", "Sector", "Días esperados", "Días trabajados", "Sin registro", "Sin entrada", "Sin salida", "Min. tarde", "Min. retiro", "Descuento (min)", "Horas 50%", "Horas 100%"];
      const rows = lista.map((e) => {
        const c = computarCumplimiento(porEmp[e.legajo] || [], mapHor[e.horario_id] || null, desde, hasta, config);
        return [e.legajo, `${e.apellido}, ${e.nombre}`, e.sector || "",
          c.sinTurno ? "" : c.diasEsperados, c.sinTurno ? "" : c.diasTrabajados,
          c.sinTurno ? "" : c.sinRegistro, c.sinTurno ? "" : c.sinEntrada, c.sinTurno ? "" : c.sinSalida,
          c.minTarde, c.minRetiro, c.descuentoMin, Math.round(c.horas50Min / 6) / 10, Math.round(c.horas100Min / 6) / 10];
      });
      if (!rows.length) { setError("No hay empleados para ese filtro."); setBajando(""); return; }
      descargarBytes(generarXlsx(headers, rows), `resumen_${desde.toISOString().slice(0, 10)}_a_${hasta.toISOString().slice(0, 10)}.xlsx`);
      setOk(`Resumen generado: ${rows.length} empleados.`);
    } catch { setError("No se pudo generar el resumen."); }
    finally { setBajando(""); }
  };

  const { desde, hasta } = calcularPeriodo(refMes);

  return (
    <div className="max-w-xl">
      <div className="bg-[#1c2128] border border-[#2d3748] rounded-2xl p-5">
        <h2 className="text-base font-bold mb-1">Exportar a Excel</h2>
        <p className="text-[#5a6578] text-xs mb-5">Descargá las fichadas o un resumen por empleado del período.</p>

        <p className="text-[10px] uppercase tracking-widest text-[#5a6578] mb-2">Alcance</p>
        <div className="flex gap-2 mb-4 flex-wrap">
          {[{ id: "todos", label: "Todos" }, { id: "sector", label: "Un sector" }, { id: "empleado", label: "Un empleado" }].map((o) => (
            <button key={o.id} onClick={() => { setAlcance(o.id); setError(null); setOk(null); }}
              className="px-3 py-2 rounded-lg text-xs font-semibold border"
              style={{ backgroundColor: alcance === o.id ? "#f2a900" : "#242b35", color: alcance === o.id ? "#12161c" : "#8b95a5", borderColor: alcance === o.id ? "#f2a900" : "#3a4353" }}>
              {o.label}
            </button>
          ))}
        </div>

        {alcance === "sector" && (
          <select value={sector} onChange={(e) => setSector(e.target.value)} className="w-full bg-[#242b35] border border-[#3a4353] rounded-lg px-3 py-2.5 text-sm outline-none mb-4">
            <option value="">— Elegí un sector —</option>
            {datos.sectores.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {alcance === "empleado" && (
          <select value={legajo} onChange={(e) => setLegajo(e.target.value)} className="w-full bg-[#242b35] border border-[#3a4353] rounded-lg px-3 py-2.5 text-sm outline-none mb-4">
            <option value="">— Elegí un empleado —</option>
            {datos.empleados.map((e) => <option key={e.legajo} value={e.legajo}>{e.apellido}, {e.nombre} ({e.legajo})</option>)}
          </select>
        )}

        <p className="text-[10px] uppercase tracking-widest text-[#5a6578] mb-2">Período</p>
        <div className="rounded-xl bg-[#242b35] border border-[#2d3748] p-3 flex items-center justify-between mb-5">
          <button onClick={() => setRefMes((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="text-[#8b95a5] px-2 text-lg">‹</button>
          <p className="text-sm font-semibold">{etiquetaPeriodo(desde, hasta)}</p>
          <button onClick={() => setRefMes((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="text-[#8b95a5] px-2 text-lg">›</button>
        </div>

        {error && <p className="text-[#e5484d] text-xs mb-3">{error}</p>}
        {ok && <p className="text-[#3ddc84] text-xs mb-3 font-semibold">{ok}</p>}

        <button onClick={descargarDetalle} disabled={!!bajando} className="w-full py-3 rounded-xl font-bold text-sm bg-[#f2a900] text-[#12161c] disabled:opacity-50">
          {bajando === "detalle" ? "Generando…" : "⬇ Descargar fichadas (detalle)"}
        </button>
        <button onClick={descargarResumen} disabled={!!bajando} className="w-full mt-2 py-3 rounded-xl font-bold text-sm bg-[#242b35] border border-[#3a4353] disabled:opacity-50">
          {bajando === "resumen" ? "Generando…" : "📊 Resumen por empleado (descuentos, 100%, faltantes)"}
        </button>
      </div>
    </div>
  );
}
