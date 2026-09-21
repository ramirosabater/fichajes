import { useState, useEffect } from "react";
import { sbRpc } from "../lib/supabase.js";

const TIPOS = { dia_libre: "Día libre", ausencia: "Ausencia", vacaciones: "Vacaciones", otro: "Otro" };
const fechaCorta = (f) => (f ? new Date(f + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : "");
const badge = (estado) => {
  const m = { pendiente: ["#f2a900", "rgba(242,169,0,.12)", "Pendiente"], aprobada: ["#16a34a", "rgba(22,163,74,.12)", "Aprobada"], rechazada: ["#e5484d", "rgba(229,72,77,.12)", "Rechazada"] };
  return m[estado] || m.pendiente;
};

export default function Ausencias({ empleado, pin, esJefe, onVolver }) {
  const [tab, setTab] = useState("mias"); // mias | equipo
  const [mias, setMias] = useState([]);
  const [equipo, setEquipo] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [msg, setMsg] = useState(null);

  // form
  const [tipo, setTipo] = useState("dia_libre");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    try {
      const r = await sbRpc("mis_solicitudes", { p_legajo: empleado.legajo, p_pin: pin });
      setMias(r?.solicitudes || []);
      if (esJefe) {
        const re = await sbRpc("solicitudes_equipo", { p_legajo: empleado.legajo, p_pin: pin });
        setEquipo(re?.solicitudes || []);
      }
    } catch { /* ignore */ }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  const pedir = async () => {
    setMsg(null);
    if (!desde) return setMsg({ ok: false, t: "Elegí la fecha desde." });
    setEnviando(true);
    try {
      const r = await sbRpc("crear_solicitud", {
        p_legajo: empleado.legajo, p_pin: pin, p_tipo: tipo,
        p_desde: desde, p_hasta: hasta || desde, p_motivo: motivo.trim() || null,
      });
      if (!r?.ok) throw new Error();
      setDesde(""); setHasta(""); setMotivo("");
      setMsg({ ok: true, t: "Solicitud enviada. Tu jefe la va a revisar." });
      cargar();
    } catch { setMsg({ ok: false, t: "No se pudo enviar la solicitud." }); }
    finally { setEnviando(false); }
  };

  const resolver = async (id, estado) => {
    const resolucion = estado === "rechazada" ? (prompt("Motivo del rechazo (opcional):") || "") : "";
    try {
      const r = await sbRpc("resolver_solicitud", { p_legajo: empleado.legajo, p_pin: pin, p_id: id, p_estado: estado, p_resolucion: resolucion || null });
      if (!r?.ok) throw new Error();
      setEquipo((eq) => eq.map((s) => (s.id === id ? { ...s, estado, resolucion } : s)));
    } catch { alert("No se pudo resolver la solicitud."); }
  };

  return (
    <div className="min-h-screen w-full flex items-start justify-center p-4">
      <div className="w-full max-w-[440px] bg-white rounded-[28px] shadow-lg border border-[#e3e8ed] overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-dashed border-[#cfd6dd]">
          <div><p className="text-sm font-bold">📅 Ausencias</p><p className="text-[#94a1ab] text-xs">{empleado.apellido}, {empleado.nombre}</p></div>
          <button onClick={onVolver} className="text-[#94a1ab] hover:text-[#1f2d38] text-xl leading-none">×</button>
        </div>

        {esJefe && (
          <div className="flex border-b border-[#e3e8ed]">
            {[["mias", "Mis solicitudes"], ["equipo", `Mi equipo${equipo.filter((s) => s.estado === "pendiente").length ? ` (${equipo.filter((s) => s.estado === "pendiente").length})` : ""}`]].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} className="flex-1 py-2.5 text-sm font-semibold" style={{ color: tab === id ? "#e1251b" : "#94a1ab", borderBottom: tab === id ? "2px solid #e1251b" : "2px solid transparent" }}>{label}</button>
            ))}
          </div>
        )}

        <div className="px-6 py-4">
          {tab === "mias" ? (
            <>
              {/* Form */}
              <div className="bg-[#f1f4f7] border border-[#e3e8ed] rounded-xl p-3 mb-4">
                <p className="text-[10px] uppercase tracking-widest text-[#94a1ab] mb-2">Pedir ausencia / día libre</p>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full bg-white border border-[#cfd6dd] rounded-lg px-3 py-2 text-sm outline-none mb-2">
                  {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <div className="flex gap-2 mb-2">
                  <div className="flex-1"><label className="text-[10px] text-[#94a1ab]">Desde</label><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-full bg-white border border-[#cfd6dd] rounded-lg px-2 py-2 text-sm outline-none" /></div>
                  <div className="flex-1"><label className="text-[10px] text-[#94a1ab]">Hasta</label><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-full bg-white border border-[#cfd6dd] rounded-lg px-2 py-2 text-sm outline-none" /></div>
                </div>
                <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Motivo (opcional)" className="w-full bg-white border border-[#cfd6dd] rounded-lg px-3 py-2 text-sm outline-none resize-none" />
                {msg && <p className={`text-xs mt-2 ${msg.ok ? "text-[#16a34a]" : "text-[#e5484d]"}`}>{msg.t}</p>}
                <button onClick={pedir} disabled={enviando} className="w-full mt-2 py-2.5 rounded-lg font-bold text-sm bg-[#e1251b] text-white disabled:opacity-50">{enviando ? "Enviando…" : "Enviar solicitud"}</button>
              </div>

              <p className="text-[10px] uppercase tracking-widest text-[#94a1ab] mb-2">Mis solicitudes</p>
              {cargando ? <p className="text-[#94a1ab] text-sm">Cargando…</p> : mias.length === 0 ? <p className="text-[#94a1ab] text-sm italic">Todavía no hiciste ninguna.</p> : (
                <div className="space-y-2">
                  {mias.map((s) => { const [col, bg, txt] = badge(s.estado); return (
                    <div key={s.id} className="border border-[#e3e8ed] rounded-lg p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{TIPOS[s.tipo] || s.tipo} · {fechaCorta(s.fecha_desde)}{s.fecha_hasta !== s.fecha_desde ? ` al ${fechaCorta(s.fecha_hasta)}` : ""}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ color: col, backgroundColor: bg }}>{txt}</span>
                      </div>
                      {s.motivo && <p className="text-xs text-[#94a1ab] mt-1">{s.motivo}</p>}
                      {s.resolucion && <p className="text-xs text-[#e5484d] mt-1">Nota: {s.resolucion}</p>}
                    </div>
                  ); })}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-[10px] uppercase tracking-widest text-[#94a1ab] mb-2">Solicitudes de mi equipo</p>
              {cargando ? <p className="text-[#94a1ab] text-sm">Cargando…</p> : equipo.length === 0 ? <p className="text-[#94a1ab] text-sm italic">No hay solicitudes.</p> : (
                <div className="space-y-2">
                  {equipo.map((s) => { const [col, bg, txt] = badge(s.estado); return (
                    <div key={s.id} className="border border-[#e3e8ed] rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold">{s.apellido}, {s.nombre}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ color: col, backgroundColor: bg }}>{txt}</span>
                      </div>
                      <p className="text-xs">{TIPOS[s.tipo] || s.tipo} · {fechaCorta(s.fecha_desde)}{s.fecha_hasta !== s.fecha_desde ? ` al ${fechaCorta(s.fecha_hasta)}` : ""}</p>
                      {s.motivo && <p className="text-xs text-[#94a1ab] mt-1">{s.motivo}</p>}
                      {s.estado === "pendiente" && (
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => resolver(s.id, "rechazada")} className="flex-1 py-2 rounded-lg text-xs font-bold border border-[#e5484d]/50 text-[#e5484d]">Rechazar</button>
                          <button onClick={() => resolver(s.id, "aprobada")} className="flex-1 py-2 rounded-lg text-xs font-bold bg-[#16a34a] text-white">Aprobar</button>
                        </div>
                      )}
                    </div>
                  ); })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
