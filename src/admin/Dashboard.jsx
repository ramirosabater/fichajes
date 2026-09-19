import { useState, useEffect } from "react";
import { sbGet } from "./supabase-admin.js";
import { calcularPeriodo, etiquetaPeriodo } from "../lib/fichaje.js";
import { computarDashboard, formatHoras } from "./dashboard-utils.js";

function Ranking({ titulo, color, filas, vacio }) {
  return (
    <div className="bg-[#ffffff] border border-[#e3e8ed] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#e3e8ed]"><p className="text-sm font-bold" style={{ color }}>{titulo}</p></div>
      {filas.length === 0 ? (
        <p className="text-[#94a1ab] text-xs italic px-4 py-6 text-center">{vacio}</p>
      ) : (
        <div className="divide-y divide-[#f1f4f7]">
          {filas.map((f, i) => (
            <div key={f.legajo} className="px-4 py-2.5 flex items-center gap-3">
              <span className="w-5 text-xs font-bold tabular-nums text-[#94a1ab]">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{f.apellido}, {f.nombre}</p>
                <p className="text-[10px] text-[#94a1ab]">{f.sector} · leg. {f.legajo}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold tabular-nums" style={{ color }}>{f.tarde}</p>
                <p className="text-[10px] text-[#94a1ab]">{f.minDesvio > 0 ? `${f.minDesvio} min` : "—"}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [refMes, setRefMes] = useState(new Date());
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setCargando(true); setError(null);
      try {
        const { desde, hasta } = calcularPeriodo(refMes);
        const [fichajes, empleados] = await Promise.all([
          sbGet(`fichajes?timestamp=gte.${desde.toISOString()}&timestamp=lte.${hasta.toISOString()}&order=timestamp.asc&limit=200000`),
          sbGet("empleados?select=legajo,nombre,apellido,sector,activo"),
        ]);
        if (cancel) return;
        setData(computarDashboard(fichajes, empleados));
      } catch {
        if (!cancel) setError("No se pudieron cargar las estadísticas.");
      } finally {
        if (!cancel) setCargando(false);
      }
    })();
    return () => { cancel = true; };
  }, [refMes]);

  const { desde, hasta } = calcularPeriodo(refMes);

  const kpis = data ? [
    { label: "Horas trabajadas", valor: formatHoras(data.totalTrabajadoMs), color: "#16a34a" },
    { label: "Tiempo perdido (tarde+salidas)", valor: formatHoras(data.totalMinDesvio * 60000), color: "#e5484d", small: true },
    { label: "Puntualidad", valor: `${data.puntualidad.toFixed(0)}%`, color: "#e1251b" },
    { label: "Llegadas tarde", valor: String(data.totalTarde), color: "#e5484d" },
    { label: "Salidas anticipadas", valor: String(data.totalSalidaAnt), color: "#e1251b" },
    { label: "Min. tarde / temprano", valor: `${data.totalMinTarde} / ${data.totalMinTemprano}`, color: "#2ba9e0", small: true },
    { label: "Empleados activos", valor: `${data.empleadosActivos}/${data.empleadosTotal}`, color: "#1f2d38" },
    { label: "Sector + tardanzas", valor: data.sectorTop ? data.sectorTop.sector : "—", color: "#1f2d38", small: true },
  ] : [];

  return (
    <div>
      <div className="max-w-[280px] rounded-xl bg-[#ffffff] border border-[#e3e8ed] p-3 flex items-center justify-between mb-5">
        <button onClick={() => setRefMes((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="text-[#5c6b78] hover:text-[#1f2d38] px-2 text-lg">‹</button>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-widest text-[#94a1ab]">Período</p>
          <p className="text-sm font-semibold">{etiquetaPeriodo(desde, hasta)}</p>
        </div>
        <button onClick={() => setRefMes((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="text-[#5c6b78] hover:text-[#1f2d38] px-2 text-lg">›</button>
      </div>

      {cargando ? (
        <p className="text-[#5c6b78] text-center py-16">Calculando estadísticas…</p>
      ) : error ? (
        <p className="text-[#e5484d] text-center py-10">{error}</p>
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {kpis.map((k, i) => (
              <div key={i} className="bg-[#ffffff] border border-[#e3e8ed] rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-wider text-[#94a1ab] mb-1">{k.label}</p>
                <p className={k.small ? "text-base font-bold" : "text-2xl font-black"} style={{ color: k.color }}>{k.valor}</p>
              </div>
            ))}
          </div>

          <div className="bg-[#ffffff] border border-[#e3e8ed] rounded-xl p-4 mb-6">
            <p className="text-xs text-[#5c6b78] mb-2 font-semibold">Trabajado vs. tiempo perdido (empresa)</p>
            {(() => {
              const trab = data.totalTrabajadoMs / 60000, perd = data.totalMinDesvio, tot = trab + perd || 1;
              const p = (trab / tot) * 100;
              return (
                <>
                  <div className="w-full h-4 rounded-full overflow-hidden flex bg-[#f1f4f7]">
                    <div style={{ width: `${p}%`, backgroundColor: "#16a34a" }} />
                    <div style={{ width: `${100 - p}%`, backgroundColor: "#e5484d" }} />
                  </div>
                  <div className="flex justify-between mt-2 text-[11px]">
                    <span className="text-[#16a34a]">{formatHoras(data.totalTrabajadoMs)} trabajadas</span>
                    <span className="text-[#e5484d]">{formatHoras(perd * 60000)} perdidas</span>
                  </div>
                </>
              );
            })()}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Ranking titulo="Top 20 · Más llegadas tarde" color="#e5484d" filas={data.masTarde} vacio="No hubo llegadas tarde en el período." />
            <Ranking titulo="Top 20 · Más puntuales" color="#16a34a" filas={data.menosTarde} vacio="Sin datos de fichadas en el período." />
          </div>
        </>
      )}
    </div>
  );
}
