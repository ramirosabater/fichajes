import { useState, useEffect } from "react";
import { sbGet, sbPatch, registrarAuditoria } from "./supabase-admin.js";

const TIPOS = { dia_libre: "Día libre", ausencia: "Ausencia", vacaciones: "Vacaciones", otro: "Otro" };
const fechaCorta = (f) => (f ? new Date(f + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "");
const estCol = { pendiente: ["#f2a900", "rgba(242,169,0,.12)"], aprobada: ["#16a34a", "rgba(22,163,74,.12)"], rechazada: ["#e5484d", "rgba(229,72,77,.12)"] };

export default function AusenciasAdmin() {
  const [sols, setSols] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState("pendiente");

  const cargar = async () => {
    setCargando(true); setError(null);
    try {
      const [s, e] = await Promise.all([
        sbGet("solicitudes?select=*&order=creado_en.desc&limit=1000"),
        sbGet("empleados?select=legajo,apellido,nombre"),
      ]);
      setSols(s); setEmpleados(e);
    } catch { setError("No se pudieron cargar las solicitudes."); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const nombre = (legajo) => { const e = empleados.find((x) => x.legajo === legajo); return e ? `${e.apellido}, ${e.nombre}` : `Legajo ${legajo}`; };

  const resolver = async (s, estado) => {
    const resolucion = estado === "rechazada" ? (prompt("Motivo del rechazo (opcional):") || "") : "";
    try {
      await sbPatch(`solicitudes?id=eq.${s.id}`, { estado, resolucion: resolucion || null, resuelto_en: new Date().toISOString() });
      registrarAuditoria(`${estado === "aprobada" ? "Aprobó" : "Rechazó"} ausencia de ${nombre(s.legajo)}`, `${TIPOS[s.tipo] || s.tipo} ${fechaCorta(s.fecha_desde)}`);
      setSols((ss) => ss.map((x) => (x.id === s.id ? { ...x, estado } : x)));
    } catch { alert("No se pudo resolver."); }
  };

  const lista = sols.filter((s) => filtro === "todas" || s.estado === filtro);

  if (cargando) return <p className="text-[#5c6b78] text-center py-16">Cargando…</p>;
  if (error) return <p className="text-[#e5484d] text-center py-10">{error}</p>;

  return (
    <div className="max-w-2xl">
      <h2 className="text-base font-bold mb-3">Solicitudes de ausencia</h2>
      <div className="flex gap-2 mb-4">
        {[["pendiente", "Pendientes"], ["aprobada", "Aprobadas"], ["rechazada", "Rechazadas"], ["todas", "Todas"]].map(([id, l]) => (
          <button key={id} onClick={() => setFiltro(id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
            style={{ backgroundColor: filtro === id ? "#e1251b" : "#f1f4f7", color: filtro === id ? "#fff" : "#5c6b78", borderColor: filtro === id ? "#e1251b" : "#cfd6dd" }}>{l}</button>
        ))}
      </div>

      {lista.length === 0 ? <p className="text-[#94a1ab] text-sm italic">No hay solicitudes en esta vista.</p> : (
        <div className="space-y-2">
          {lista.map((s) => { const [col, bg] = estCol[s.estado] || estCol.pendiente; return (
            <div key={s.id} className="bg-white border border-[#e3e8ed] rounded-xl p-3 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold">{nombre(s.legajo)}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded capitalize" style={{ color: col, backgroundColor: bg }}>{s.estado}</span>
              </div>
              <p className="text-xs">{TIPOS[s.tipo] || s.tipo} · {fechaCorta(s.fecha_desde)}{s.fecha_hasta !== s.fecha_desde ? ` al ${fechaCorta(s.fecha_hasta)}` : ""}</p>
              {s.motivo && <p className="text-xs text-[#94a1ab] mt-1">{s.motivo}</p>}
              {s.estado === "pendiente" && (
                <div className="flex gap-2 mt-2">
                  <button onClick={() => resolver(s, "rechazada")} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#e5484d]/50 text-[#e5484d]">Rechazar</button>
                  <button onClick={() => resolver(s, "aprobada")} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#16a34a] text-white">Aprobar</button>
                </div>
              )}
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}
