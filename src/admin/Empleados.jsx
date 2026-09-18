import { useState, useEffect } from "react";
import { sbGet, sbPatch, sbRpc } from "./supabase-admin.js";

export default function Empleados() {
  const [empleados, setEmpleados] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [sectores, setSectores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [guardado, setGuardado] = useState(null);

  const [pinEdit, setPinEdit] = useState(null);
  const [pinValor, setPinValor] = useState("");
  const [pinOk, setPinOk] = useState(null);

  const cargar = async () => {
    setCargando(true); setError(null);
    try {
      const [emps, hs] = await Promise.all([
        sbGet("empleados?select=*&order=apellido.asc"),
        sbGet("horarios?select=*&order=nombre.asc"),
      ]);
      setEmpleados(emps); setHorarios(hs);
      // sectores desde su tabla; si no existe, usar los distintos de empleados
      try {
        const sec = await sbGet("sectores?select=nombre&order=nombre.asc");
        setSectores(sec.map((s) => s.nombre));
      } catch {
        setSectores([...new Set(emps.map((e) => e.sector).filter(Boolean))].sort());
      }
    } catch {
      setError("No se pudieron cargar los empleados.");
    } finally {
      setCargando(false);
    }
  };
  useEffect(() => { cargar(); }, []);

  const cambiarCampo = async (legajo, campo, valor) => {
    const anterior = empleados.find((e) => e.legajo === legajo)?.[campo];
    setEmpleados((prev) => prev.map((e) => (e.legajo === legajo ? { ...e, [campo]: valor } : e)));
    try {
      await sbPatch(`empleados?legajo=eq.${legajo}`, { [campo]: valor });
      setGuardado(legajo);
      setTimeout(() => setGuardado((c) => (c === legajo ? null : c)), 1400);
    } catch {
      setEmpleados((prev) => prev.map((e) => (e.legajo === legajo ? { ...e, [campo]: anterior } : e)));
      alert("No se pudo guardar el cambio. Probá de nuevo.");
    }
  };

  const guardarPin = async (legajo) => {
    if (!pinValor || pinValor.length < 4) { alert("El PIN debe tener al menos 4 dígitos."); return; }
    try {
      const r = await sbRpc("set_pin_admin", { p_legajo: legajo, p_nuevo_pin: pinValor });
      if (!r || !r.ok) throw new Error();
      setPinEdit(null); setPinValor(""); setPinOk(legajo);
      setTimeout(() => setPinOk((c) => (c === legajo ? null : c)), 1800);
    } catch { alert("No se pudo cambiar el PIN."); }
  };

  const lista = empleados.filter((e) =>
    (`${e.apellido} ${e.nombre} ${e.legajo} ${e.sector || ""}`).toLowerCase().includes(busqueda.toLowerCase()));

  if (cargando) return <p className="text-[#8b95a5] text-center py-16">Cargando empleados…</p>;
  if (error) return <p className="text-[#e5484d] text-center py-10">{error}</p>;

  return (
    <div>
      <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar empleado…"
        className="w-full max-w-sm mb-4 bg-[#242b35] border border-[#3a4353] rounded-lg px-3 py-2 text-sm outline-none" />
      <div className="space-y-3">
        {lista.map((e) => (
          <div key={e.legajo} className="bg-[#1c2128] border border-[#2d3748] rounded-xl p-4 flex items-start gap-4 flex-wrap"
            style={{ opacity: e.activo !== false ? 1 : 0.55 }}>
            <div className="min-w-[160px]">
              <p className="text-sm font-semibold">{e.apellido}, {e.nombre}</p>
              <p className="text-[11px] text-[#5a6578]">Legajo {e.legajo}</p>
              <button onClick={() => cambiarCampo(e.legajo, "activo", !(e.activo !== false))}
                className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold border"
                style={{
                  backgroundColor: e.activo !== false ? "rgba(61,220,132,.12)" : "rgba(90,101,120,.15)",
                  color: e.activo !== false ? "#3ddc84" : "#8b95a5",
                  borderColor: e.activo !== false ? "rgba(61,220,132,.4)" : "#3a4353",
                }}>
                {e.activo !== false ? "● Activo" : "○ Inactivo"}
              </button>
              {pinEdit === e.legajo ? (
                <div className="flex items-center gap-1 mt-2">
                  <input value={pinValor} onChange={(ev) => setPinValor(ev.target.value)} inputMode="numeric" autoFocus placeholder="PIN nuevo"
                    onKeyDown={(ev) => ev.key === "Enter" && guardarPin(e.legajo)}
                    className="w-24 bg-[#242b35] border border-[#3a4353] rounded-lg px-2 py-1 text-xs outline-none" />
                  <button onClick={() => guardarPin(e.legajo)} className="px-2 py-1 rounded-lg text-[11px] font-bold bg-[#f2a900] text-[#12161c]">OK</button>
                  <button onClick={() => { setPinEdit(null); setPinValor(""); }} className="px-1.5 py-1 text-[11px] text-[#8b95a5]">✕</button>
                </div>
              ) : (
                <button onClick={() => { setPinEdit(e.legajo); setPinValor(""); }} className="mt-2 block text-[11px] text-[#5a6578] hover:text-[#8b95a5]">
                  {pinOk === e.legajo ? <span className="text-[#3ddc84] font-semibold">🔑 PIN actualizado ✓</span> : "🔑 Cambiar PIN"}
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-[#5a6578]">Sector</label>
              <select value={e.sector || ""} onChange={(ev) => cambiarCampo(e.legajo, "sector", ev.target.value || null)}
                className="bg-[#242b35] border border-[#3a4353] rounded-lg px-2.5 py-2 text-xs outline-none min-w-[130px]">
                <option value="">— Sin sector —</option>
                {sectores.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-[#5a6578]">Responsable</label>
              <select value={e.responsable_legajo ?? ""} onChange={(ev) => cambiarCampo(e.legajo, "responsable_legajo", ev.target.value === "" ? null : parseInt(ev.target.value, 10))}
                className="bg-[#242b35] border border-[#3a4353] rounded-lg px-2.5 py-2 text-xs outline-none min-w-[160px] max-w-[200px]">
                <option value="">— Sin responsable —</option>
                {empleados.filter((r) => r.legajo !== e.legajo).map((r) => (
                  <option key={r.legajo} value={r.legajo}>{r.apellido}, {r.nombre} ({r.legajo})</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-[#5a6578] flex items-center gap-1">
                Turno {guardado === e.legajo && <span className="text-[#3ddc84] normal-case tracking-normal">✓ guardado</span>}
              </label>
              <select value={e.horario_id || ""} onChange={(ev) => cambiarCampo(e.legajo, "horario_id", ev.target.value || null)}
                className="bg-[#242b35] border border-[#3a4353] rounded-lg px-2.5 py-2 text-xs outline-none max-w-[220px]">
                <option value="">— Sin turno —</option>
                {horarios.map((h) => <option key={h.id} value={h.id}>{h.nombre}</option>)}
              </select>
            </div>
          </div>
        ))}
        {lista.length === 0 && <p className="text-[#5a6578] text-sm italic">No se encontraron empleados.</p>}
      </div>
    </div>
  );
}
