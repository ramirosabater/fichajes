import { useState, useEffect } from "react";
import { sbGet, sbPatch, registrarAuditoria } from "./supabase-admin.js";

export default function Aprobaciones() {
  const [pendientes, setPendientes] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [resol, setResol] = useState({});
  const [procesando, setProcesando] = useState(null);

  const cargar = async () => {
    setCargando(true); setError(null);
    try {
      const [obs, emps] = await Promise.all([
        sbGet("verificaciones?estado=eq.observado&order=verificado_en.desc&limit=500"),
        sbGet("empleados?select=legajo,apellido,nombre"),
      ]);
      setPendientes(obs); setEmpleados(emps);
    } catch { setError("No se pudieron cargar las observaciones."); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const resolver = async (obs, decision) => {
    setProcesando(obs.id);
    try {
      await sbPatch(`verificaciones?id=eq.${obs.id}`, {
        estado: decision === "aprobar" ? "admin_aprobado" : "admin_rechazado",
        resolucion: (resol[obs.id] || "").trim() || null,
        resuelto_en: new Date().toISOString(),
      });
      registrarAuditoria(`${decision === "aprobar" ? "Aprobó" : "Rechazó"} observación de ${obs.sector || ""}`, obs.motivo || null);
      setPendientes((p) => p.filter((o) => o.id !== obs.id));
    } catch { alert("No se pudo guardar la decisión."); }
    finally { setProcesando(null); }
  };

  const fmt = (d) => (d ? new Date(d + "T00:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short" }) : "");

  if (cargando) return <p className="text-[#5c6b78] text-center py-16">Cargando…</p>;
  if (error) return <p className="text-[#e5484d] text-center py-10">{error}</p>;

  return (
    <div className="max-w-2xl">
      <h2 className="text-base font-bold mb-1">Observaciones para revisar</h2>
      <p className="text-[#94a1ab] text-xs mb-5">Casos que un encargado marcó como <span className="text-[#e1251b]">no aprobados</span>.</p>

      {pendientes.length === 0 ? (
        <div className="bg-[#ffffff] border border-[#e3e8ed] rounded-xl px-4 py-10 text-center">
          <p className="text-2xl mb-2">✓</p>
          <p className="text-[#5c6b78] text-sm">No hay observaciones pendientes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendientes.map((obs) => {
            const resp = empleados.find((e) => e.legajo === obs.responsable_legajo);
            const proc = procesando === obs.id;
            return (
              <div key={obs.id} className="bg-[#ffffff] border rounded-xl p-4" style={{ borderColor: "rgba(225,37,27,.4)" }}>
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold">{resp ? `${resp.apellido}, ${resp.nombre}` : `Legajo ${obs.responsable_legajo}`}</p>
                    <p className="text-[11px] text-[#94a1ab]">{obs.sector || "—"} · período {fmt(obs.periodo_desde)} al {fmt(obs.periodo_hasta)} · {obs.cantidad_empleados || 0} personas</p>
                  </div>
                  <span className="text-[10px] text-[#94a1ab]">{obs.verificado_en ? new Date(obs.verificado_en).toLocaleDateString("es-AR") : ""}</span>
                </div>
                <div className="rounded-lg bg-[#f1f4f7] border border-[#cfd6dd] px-3 py-2 mb-3">
                  <p className="text-[10px] uppercase tracking-widest text-[#94a1ab] mb-1">Motivo del encargado</p>
                  <p className="text-xs whitespace-pre-line">{obs.motivo || "(sin motivo)"}</p>
                </div>
                <input value={resol[obs.id] || ""} onChange={(e) => setResol((p) => ({ ...p, [obs.id]: e.target.value }))}
                  placeholder="Resolución / comentario (opcional)"
                  className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2 text-xs outline-none mb-3" />
                <div className="flex gap-2">
                  <button onClick={() => resolver(obs, "rechazar")} disabled={proc}
                    className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-[#f1f4f7] border border-[#e5484d]/50 text-[#e5484d] disabled:opacity-40">Rechazar</button>
                  <button onClick={() => resolver(obs, "aprobar")} disabled={proc}
                    className="flex-1 py-2.5 rounded-xl font-bold text-xs disabled:opacity-40" style={{ backgroundColor: "#16a34a", color: "#ffffff" }}>
                    {proc ? "…" : "Aprobar"}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
