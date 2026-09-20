import { useState, useEffect } from "react";
import { sbGet } from "./supabase-admin.js";

export default function Presentismo() {
  const [dentro, setDentro] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [actualizado, setActualizado] = useState(null);
  const [ahora, setAhora] = useState(new Date());

  useEffect(() => { const t = setInterval(() => setAhora(new Date()), 30000); return () => clearInterval(t); }, []);

  const cargar = async () => {
    setCargando(true); setError(null);
    try {
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const [fichajes, emps] = await Promise.all([
        sbGet(`fichajes?timestamp=gte.${hoy.toISOString()}&order=timestamp.asc&limit=100000`),
        empleados.length ? Promise.resolve(empleados) : sbGet("empleados?select=legajo,nombre,apellido,sector,activo"),
      ]);
      if (!empleados.length) setEmpleados(emps);
      const mapEmp = {}; (empleados.length ? empleados : emps).forEach((e) => (mapEmp[e.legajo] = e));
      // último movimiento de hoy por empleado
      const ultimo = {};
      fichajes.forEach((f) => { ultimo[f.legajo] = f; });
      const activos = Object.values(ultimo)
        .filter((f) => f.tipo === "entrada" && (mapEmp[f.legajo] || {}).activo !== false)
        .map((f) => {
          const e = mapEmp[f.legajo] || {};
          return { legajo: f.legajo, nombre: e.nombre || "?", apellido: e.apellido || "?", sector: e.sector || "Sin sector", desde: new Date(f.timestamp) };
        })
        .sort((a, b) => a.apellido.localeCompare(b.apellido));
      setDentro(activos);
      setActualizado(new Date());
    } catch { setError("No se pudo cargar el presentismo."); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); const t = setInterval(cargar, 60000); return () => clearInterval(t); /* eslint-disable-next-line */ }, []);

  const dur = (desde) => {
    const ms = ahora - desde;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  };

  // agrupar por sector
  const porSector = {};
  dentro.forEach((d) => { (porSector[d.sector] = porSector[d.sector] || []).push(d); });

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold">Presentismo en vivo</h2>
          <p className="text-[#94a1ab] text-xs">
            {cargando ? "Actualizando…" : `${dentro.length} persona${dentro.length !== 1 ? "s" : ""} fichada${dentro.length !== 1 ? "s" : ""} ahora`}
            {actualizado && ` · ${actualizado.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`}
          </p>
        </div>
        <button onClick={cargar} className="text-xs px-3 py-1.5 rounded-lg border border-[#e3e8ed] bg-white text-[#5c6b78]">↻ Actualizar</button>
      </div>

      {error ? (
        <p className="text-[#e5484d] text-center py-10">{error}</p>
      ) : dentro.length === 0 && !cargando ? (
        <div className="bg-white border border-[#e3e8ed] rounded-xl px-4 py-10 text-center shadow-sm">
          <p className="text-2xl mb-2">🌙</p>
          <p className="text-[#94a1ab] text-sm">No hay nadie fichado en este momento.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.keys(porSector).sort().map((sector) => (
            <div key={sector} className="bg-white border border-[#e3e8ed] rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-2 border-b border-[#e3e8ed] flex items-center justify-between bg-[#f1f4f7]">
                <p className="text-xs font-bold uppercase tracking-wide text-[#5c6b78]">{sector}</p>
                <span className="text-xs text-[#94a1ab]">{porSector[sector].length}</span>
              </div>
              <div className="divide-y divide-[#f1f4f7]">
                {porSector[sector].map((d) => (
                  <div key={d.legajo} className="px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#16a34a]"></span>
                      <p className="text-sm">{d.apellido}, {d.nombre} <span className="text-[#94a1ab] text-xs">· leg. {d.legajo}</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-[#16a34a] tabular-nums">{dur(d.desde)}</p>
                      <p className="text-[10px] text-[#94a1ab]">desde {d.desde.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
