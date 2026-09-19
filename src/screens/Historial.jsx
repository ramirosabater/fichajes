import { useState, useEffect } from "react";
import { sbRpc } from "../lib/supabase.js";
import { calcularPeriodo } from "../lib/fichaje.js";

const fmtPeriodo = (desde, hasta) => {
  const f = (d) => d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
  return `${f(desde)} al ${f(hasta)}`;
};

export default function Historial({ empleado, pin, onVolver }) {
  const [refMes, setRefMes] = useState(new Date());
  const { desde, hasta } = calcularPeriodo(refMes);
  const [fichajes, setFichajes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setCargando(true);
      setError(null);
      try {
        const r = await sbRpc("mi_historial", {
          p_legajo: empleado.legajo, p_pin: pin,
          p_desde: desde.toISOString(), p_hasta: hasta.toISOString(),
        });
        if (cancel) return;
        if (!r || !r.ok) setError("No se pudo cargar el historial.");
        else setFichajes(Array.isArray(r.fichajes) ? r.fichajes : []);
      } catch {
        if (!cancel) setError("No se pudo conectar con la base.");
      } finally {
        if (!cancel) setCargando(false);
      }
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refMes]);

  const cambiarMes = (delta) => setRefMes((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));

  const porDia = {};
  fichajes.forEach((f) => {
    const dia = new Date(f.timestamp).toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "2-digit" });
    (porDia[dia] = porDia[dia] || []).push(f);
  });
  const tardeTotal = fichajes.filter((f) => f.estado === "tarde").length;

  return (
    <div className="min-h-screen w-full flex items-start justify-center p-4">
      <div className="w-full max-w-[420px] bg-[#ffffff] rounded-[28px] shadow-lg border border-[#e3e8ed] overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-dashed border-[#cfd6dd]">
          <div>
            <p className="text-sm font-bold">Mi historial</p>
            <p className="text-[#94a1ab] text-xs">{empleado.apellido}, {empleado.nombre}</p>
          </div>
          <button onClick={onVolver} className="text-[#94a1ab] hover:text-[#5c6b78] text-xl leading-none">×</button>
        </div>

        <div className="mx-6 mt-4 mb-3 rounded-xl bg-[#f1f4f7] border border-[#e3e8ed] p-3 flex items-center justify-between">
          <button onClick={() => cambiarMes(-1)} className="text-[#5c6b78] hover:text-[#1f2d38] px-2 text-lg">‹</button>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest text-[#94a1ab]">Período</p>
            <p className="text-sm font-semibold">{fmtPeriodo(desde, hasta)}</p>
          </div>
          <button onClick={() => cambiarMes(1)} className="text-[#5c6b78] hover:text-[#1f2d38] px-2 text-lg">›</button>
        </div>

        <div className="px-6 pb-6">
          {cargando ? (
            <p className="text-[#5c6b78] text-sm text-center py-10">Cargando…</p>
          ) : error ? (
            <p className="text-[#e5484d] text-sm text-center py-8">{error}</p>
          ) : fichajes.length === 0 ? (
            <p className="text-[#94a1ab] text-sm text-center py-8 italic">No hay fichadas en este período.</p>
          ) : (
            <>
              <p className="text-[10px] uppercase tracking-widest text-[#94a1ab] mb-3">
                {fichajes.length} fichada{fichajes.length !== 1 ? "s" : ""}
                {tardeTotal > 0 && <span className="text-[#e5484d]"> · {tardeTotal} tarde</span>}
              </p>
              <div className="space-y-3">
                {Object.keys(porDia).map((dia) => (
                  <div key={dia}>
                    <p className="text-[11px] font-semibold text-[#5c6b78] capitalize mb-1">{dia}</p>
                    <div className="rounded-xl bg-[#f1f4f7] border border-[#e3e8ed] divide-y divide-[#e3e8ed]">
                      {porDia[dia].map((f, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span className="capitalize">{f.tipo === "entrada" ? "🟢 Entrada" : "🔴 Salida"}</span>
                          <span className="flex items-center gap-2">
                            {f.estado === "tarde" && <span className="text-[10px] text-[#e5484d] font-semibold">+{f.minutos_tarde || 0}m</span>}
                            {f.estado === "salida_anticipada" && <span className="text-[10px] text-[#e1251b] font-semibold">-{f.minutos_tarde || 0}m</span>}
                            <span className="text-[#5c6b78] tabular-nums">{new Date(f.timestamp).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
