import { useState, useEffect } from "react";
import { sbGet } from "./supabase-admin.js";
import { calcularPeriodo, etiquetaPeriodo } from "../lib/fichaje.js";
import { parseUA, generarXlsx, descargarBytes } from "./xlsx.js";

function computarDispositivos(fichajes, empleados) {
  const mapEmp = {}; empleados.forEach((e) => (mapEmp[e.legajo] = e));
  const porDisp = {}, porEmpDisp = {};
  fichajes.forEach((f) => {
    if (!f.device_id || f.device_id === "sin-id") return;
    const d = (porDisp[f.device_id] = porDisp[f.device_id] || { ua: "", legajos: {}, fichajes: [] });
    if (!d.ua && f.user_agent) d.ua = f.user_agent;
    d.legajos[f.legajo] = (d.legajos[f.legajo] || 0) + 1;
    d.fichajes.push(f);
    (porEmpDisp[f.legajo] = porEmpDisp[f.legajo] || new Set()).add(f.device_id);
  });
  const compartidos = Object.entries(porDisp)
    .filter(([, d]) => Object.keys(d.legajos).length >= 2)
    .map(([device_id, d]) => ({
      device_id, ua: d.ua,
      empleados: Object.keys(d.legajos).map((lg) => { const e = mapEmp[lg] || {}; return { legajo: Number(lg), nombre: e.nombre || "?", apellido: e.apellido || "?", veces: d.legajos[lg] }; }).sort((a, b) => b.veces - a.veces),
      fichajes: d.fichajes.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).map((f) => { const e = mapEmp[f.legajo] || {}; return { legajo: f.legajo, nombre: e.nombre || "?", apellido: e.apellido || "?", timestamp: f.timestamp, tipo: f.tipo, estado: f.estado }; }),
    }))
    .sort((a, b) => b.empleados.length - a.empleados.length);
  const multi = Object.entries(porEmpDisp).filter(([, s]) => s.size >= 2)
    .map(([lg, s]) => { const e = mapEmp[lg] || {}; return { legajo: Number(lg), nombre: e.nombre || "?", apellido: e.apellido || "?", dispositivos: s.size }; })
    .sort((a, b) => b.dispositivos - a.dispositivos);

  // Fichajes remotos (sin depósito) por empleado
  const remCount = {};
  fichajes.forEach((f) => { if (!f.local_id) remCount[f.legajo] = (remCount[f.legajo] || 0) + 1; });
  const remotos = Object.entries(remCount).map(([lg, veces]) => {
    const e = mapEmp[lg] || {};
    return { legajo: Number(lg), nombre: e.nombre || "?", apellido: e.apellido || "?", veces };
  }).sort((a, b) => b.veces - a.veces);

  return { compartidos, multi, remotos };
}

export default function Dispositivos() {
  const [refMes, setRefMes] = useState(new Date());
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [abierto, setAbierto] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setCargando(true); setError(null);
      try {
        const { desde, hasta } = calcularPeriodo(refMes);
        const [fichajes, empleados] = await Promise.all([
          sbGet(`fichajes?timestamp=gte.${desde.toISOString()}&timestamp=lte.${hasta.toISOString()}&order=timestamp.asc&limit=200000`),
          sbGet("empleados?select=legajo,nombre,apellido"),
        ]);
        if (cancel) return;
        setData(computarDispositivos(fichajes, empleados));
      } catch { if (!cancel) setError("No se pudieron cargar los datos."); }
      finally { if (!cancel) setCargando(false); }
    })();
    return () => { cancel = true; };
  }, [refMes]);

  const exportar = () => {
    if (!data || !data.compartidos.length) return;
    const headers = ["Dispositivo", "Aparato", "Empleado", "Legajo", "Fecha", "Hora", "Tipo", "Estado"];
    const rows = [];
    data.compartidos.forEach((d) => d.fichajes.forEach((f) => {
      const dt = new Date(f.timestamp);
      rows.push(["…" + d.device_id.slice(-8), parseUA(d.ua), `${f.apellido}, ${f.nombre}`, f.legajo, dt.toLocaleDateString("es-AR"), dt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }), f.tipo, f.estado]);
    }));
    const { desde, hasta } = calcularPeriodo(refMes);
    descargarBytes(generarXlsx(headers, rows), `dispositivos_${desde.toISOString().slice(0, 10)}.xlsx`);
  };

  const { desde, hasta } = calcularPeriodo(refMes);

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="max-w-[280px] grow rounded-xl bg-[#ffffff] border border-[#e3e8ed] p-3 flex items-center justify-between">
          <button onClick={() => setRefMes((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="text-[#5c6b78] px-2 text-lg">‹</button>
          <p className="text-sm font-semibold">{etiquetaPeriodo(desde, hasta)}</p>
          <button onClick={() => setRefMes((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="text-[#5c6b78] px-2 text-lg">›</button>
        </div>
        {data && data.compartidos.length > 0 && (
          <button onClick={exportar} className="px-3 py-2.5 rounded-xl text-sm font-bold bg-[#e1251b] text-white">⬇ Exportar Excel</button>
        )}
      </div>

      {cargando ? <p className="text-[#5c6b78] text-center py-16">Analizando…</p>
        : error ? <p className="text-[#e5484d] text-center py-10">{error}</p>
          : !data ? null : (
            <>
              <p className="text-xs text-[#5c6b78] mb-4">
                {data.compartidos.length === 0 ? "No se detectaron dispositivos usados por más de una persona. ✓"
                  : `${data.compartidos.length} dispositivo(s) usados por 2+ personas.`}
              </p>
              <div className="space-y-3 mb-8">
                {data.compartidos.map((d) => {
                  const op = abierto === d.device_id;
                  return (
                    <div key={d.device_id} className="bg-[#ffffff] border rounded-xl overflow-hidden" style={{ borderColor: "rgba(229,72,77,.4)" }}>
                      <button onClick={() => setAbierto(op ? null : d.device_id)} className="w-full px-4 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span>📱</span>
                          <span className="text-[10px] font-mono text-[#5c6b78] bg-[#f1f4f7] px-2 py-0.5 rounded">…{d.device_id.slice(-8)}</span>
                          <span className="text-[11px] text-[#5c6b78]">{parseUA(d.ua)}</span>
                          <span className="text-[11px] text-[#e5484d] font-semibold">{d.empleados.length} personas</span>
                        </div>
                        <span className="text-[#94a1ab] text-xs">{op ? "▲" : "▼"}</span>
                      </button>
                      <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                        {d.empleados.map((e) => (
                          <span key={e.legajo} className="text-[11px] bg-[#f1f4f7] rounded-lg px-2 py-1">{e.apellido}, {e.nombre} <span className="text-[#94a1ab]">· {e.veces}</span></span>
                        ))}
                      </div>
                      {op && (
                        <div className="border-t border-[#e3e8ed] px-4 py-3">
                          <p className="text-[10px] uppercase tracking-widest text-[#94a1ab] mb-2">Línea de tiempo</p>
                          {d.fichajes.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-[#f1f4f7] last:border-0">
                              <span className="tabular-nums text-[#5c6b78] w-28 shrink-0">{new Date(f.timestamp).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                              <span>{f.tipo === "entrada" ? "🟢" : "🔴"}</span>
                              <span className="flex-1 truncate">{f.apellido}, {f.nombre}</span>
                              <span className="text-[10px] text-[#94a1ab]">{f.estado}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {data.multi.length > 0 && (
                <div className="bg-[#ffffff] border border-[#e3e8ed] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#e3e8ed]">
                    <p className="text-sm font-bold">Empleados con varios aparatos</p>
                    <p className="text-[10px] text-[#94a1ab]">Puede ser normal (casa + trabajo).</p>
                  </div>
                  <div className="divide-y divide-[#f1f4f7]">
                    {data.multi.map((m) => (
                      <div key={m.legajo} className="px-4 py-2.5 flex items-center justify-between">
                        <p className="text-xs">{m.apellido}, {m.nombre} <span className="text-[#94a1ab]">· leg. {m.legajo}</span></p>
                        <span className="text-xs text-[#e1251b] font-bold">{m.dispositivos} aparatos</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fichajes remotos por empleado */}
              <div className="bg-[#ffffff] border border-[#e3e8ed] rounded-xl overflow-hidden mt-4">
                <div className="px-4 py-3 border-b border-[#e3e8ed] flex items-center gap-2">
                  <span>📡</span>
                  <p className="text-sm font-bold">Fichajes remotos (fuera de un depósito)</p>
                </div>
                {data.remotos.length === 0 ? (
                  <p className="text-[#94a1ab] text-xs italic px-4 py-5 text-center">Todos ficharon dentro de un depósito. ✓</p>
                ) : (
                  <div className="divide-y divide-[#f1f4f7]">
                    {data.remotos.map((r) => (
                      <div key={r.legajo} className="px-4 py-2.5 flex items-center justify-between">
                        <p className="text-xs">{r.apellido}, {r.nombre} <span className="text-[#94a1ab]">· leg. {r.legajo}</span></p>
                        <span className="text-xs text-[#2ba9e0] font-bold tabular-nums">{r.veces} remoto{r.veces !== 1 ? "s" : ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
    </div>
  );
}
