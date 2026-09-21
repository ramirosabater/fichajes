import { useState, useEffect } from "react";
import { sbGet, sbPatch, sbPost, sbRpc, registrarAuditoria } from "./supabase-admin.js";

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

  // Alta de empleado
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [nuevo, setNuevo] = useState({ legajo: "", apellido: "", nombre: "", sector: "", horario_id: "", responsable_legajo: "", pin: "1234" });
  const [creando, setCreando] = useState(false);

  const crearEmpleado = async () => {
    const legajo = parseInt(nuevo.legajo, 10);
    if (!legajo) return alert("Poné un número de legajo.");
    if (empleados.some((e) => e.legajo === legajo)) return alert("Ya existe un empleado con ese legajo.");
    if (!nuevo.apellido.trim() || !nuevo.nombre.trim()) return alert("Completá apellido y nombre.");
    if (!nuevo.pin || nuevo.pin.length < 4) return alert("El PIN debe tener al menos 4 dígitos.");
    setCreando(true);
    try {
      await sbPost("empleados", {
        legajo, apellido: nuevo.apellido.trim(), nombre: nuevo.nombre.trim(),
        sector: nuevo.sector || null, horario_id: nuevo.horario_id || null,
        responsable_legajo: nuevo.responsable_legajo ? parseInt(nuevo.responsable_legajo, 10) : null,
        activo: true,
      });
      await sbRpc("set_pin_admin", { p_legajo: legajo, p_nuevo_pin: nuevo.pin });
      registrarAuditoria(`Creó al empleado ${legajo}`, `${nuevo.apellido}, ${nuevo.nombre}`);
      setNuevo({ legajo: "", apellido: "", nombre: "", sector: "", horario_id: "", responsable_legajo: "", pin: "1234" });
      setMostrarNuevo(false);
      await cargar();
    } catch { alert("No se pudo crear el empleado."); }
    finally { setCreando(false); }
  };

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
      registrarAuditoria(`Editó ${campo} de empleado ${legajo}`, String(valor));
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
      registrarAuditoria(`Cambió el PIN del empleado ${legajo}`, null);
      if (!r || !r.ok) throw new Error();
      setPinEdit(null); setPinValor(""); setPinOk(legajo);
      setTimeout(() => setPinOk((c) => (c === legajo ? null : c)), 1800);
    } catch { alert("No se pudo cambiar el PIN."); }
  };

  const lista = empleados.filter((e) =>
    (`${e.apellido} ${e.nombre} ${e.legajo} ${e.sector || ""}`).toLowerCase().includes(busqueda.toLowerCase()));

  if (cargando) return <p className="text-[#5c6b78] text-center py-16">Cargando empleados…</p>;
  if (error) return <p className="text-[#e5484d] text-center py-10">{error}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar empleado…"
          className="max-w-sm flex-1 bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2 text-sm outline-none" />
        <button onClick={() => setMostrarNuevo((v) => !v)} className="px-3 py-2 rounded-lg text-sm font-bold bg-[#223c7e] text-white">
          {mostrarNuevo ? "Cancelar" : "+ Nuevo empleado"}
        </button>
      </div>

      {mostrarNuevo && (
        <div className="bg-white border border-[#e3e8ed] rounded-xl p-4 mb-5 shadow-lg">
          <p className="text-sm font-bold mb-3">Nuevo empleado</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Legajo *</label>
              <input value={nuevo.legajo} onChange={(e) => setNuevo({ ...nuevo, legajo: e.target.value })} type="number" className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2.5 py-2 text-sm outline-none mt-1" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Apellido *</label>
              <input value={nuevo.apellido} onChange={(e) => setNuevo({ ...nuevo, apellido: e.target.value })} className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2.5 py-2 text-sm outline-none mt-1" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Nombre *</label>
              <input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2.5 py-2 text-sm outline-none mt-1" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Sector</label>
              <select value={nuevo.sector} onChange={(e) => setNuevo({ ...nuevo, sector: e.target.value })} className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2.5 py-2 text-sm outline-none mt-1">
                <option value="">—</option>
                {sectores.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Turno</label>
              <select value={nuevo.horario_id} onChange={(e) => setNuevo({ ...nuevo, horario_id: e.target.value })} className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2.5 py-2 text-sm outline-none mt-1">
                <option value="">—</option>
                {horarios.map((h) => <option key={h.id} value={h.id}>{h.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Responsable</label>
              <select value={nuevo.responsable_legajo} onChange={(e) => setNuevo({ ...nuevo, responsable_legajo: e.target.value })} className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2.5 py-2 text-sm outline-none mt-1">
                <option value="">—</option>
                {empleados.map((r) => <option key={r.legajo} value={r.legajo}>{r.apellido}, {r.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">PIN inicial</label>
              <input value={nuevo.pin} onChange={(e) => setNuevo({ ...nuevo, pin: e.target.value })} className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2.5 py-2 text-sm outline-none mt-1" />
            </div>
          </div>
          <button onClick={crearEmpleado} disabled={creando} className="mt-4 w-full py-2.5 rounded-lg font-bold text-sm bg-[#16a34a] text-white disabled:opacity-50">
            {creando ? "Creando…" : "Crear empleado"}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {lista.map((e) => (
          <div key={e.legajo} className="bg-[#ffffff] border border-[#e3e8ed] rounded-xl p-4 flex items-start gap-4 flex-wrap"
            style={{ opacity: e.activo !== false ? 1 : 0.55 }}>
            <div className="min-w-[160px]">
              <p className="text-sm font-semibold">{e.apellido}, {e.nombre}</p>
              <p className="text-[11px] text-[#94a1ab]">Legajo {e.legajo}</p>
              <button onClick={() => cambiarCampo(e.legajo, "activo", !(e.activo !== false))}
                className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold border"
                style={{
                  backgroundColor: e.activo !== false ? "rgba(61,220,132,.12)" : "rgba(90,101,120,.15)",
                  color: e.activo !== false ? "#16a34a" : "#5c6b78",
                  borderColor: e.activo !== false ? "rgba(61,220,132,.4)" : "#cfd6dd",
                }}>
                {e.activo !== false ? "● Activo" : "○ Inactivo"}
              </button>
              {pinEdit === e.legajo ? (
                <div className="flex items-center gap-1 mt-2">
                  <input value={pinValor} onChange={(ev) => setPinValor(ev.target.value)} inputMode="numeric" autoFocus placeholder="PIN nuevo"
                    onKeyDown={(ev) => ev.key === "Enter" && guardarPin(e.legajo)}
                    className="w-24 bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2 py-1 text-xs outline-none" />
                  <button onClick={() => guardarPin(e.legajo)} className="px-2 py-1 rounded-lg text-[11px] font-bold bg-[#223c7e] text-white">OK</button>
                  <button onClick={() => { setPinEdit(null); setPinValor(""); }} className="px-1.5 py-1 text-[11px] text-[#5c6b78]">✕</button>
                </div>
              ) : (
                <button onClick={() => { setPinEdit(e.legajo); setPinValor(""); }} className="mt-2 block text-[11px] text-[#94a1ab] hover:text-[#5c6b78]">
                  {pinOk === e.legajo ? <span className="text-[#16a34a] font-semibold">🔑 PIN actualizado ✓</span> : "🔑 Cambiar PIN"}
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Sector</label>
              <select value={e.sector || ""} onChange={(ev) => cambiarCampo(e.legajo, "sector", ev.target.value || null)}
                className="bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2.5 py-2 text-xs outline-none min-w-[130px]">
                <option value="">— Sin sector —</option>
                {sectores.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Responsable</label>
              <select value={e.responsable_legajo ?? ""} onChange={(ev) => cambiarCampo(e.legajo, "responsable_legajo", ev.target.value === "" ? null : parseInt(ev.target.value, 10))}
                className="bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2.5 py-2 text-xs outline-none min-w-[160px] max-w-[200px]">
                <option value="">— Sin responsable —</option>
                {empleados.filter((r) => r.legajo !== e.legajo).map((r) => (
                  <option key={r.legajo} value={r.legajo}>{r.apellido}, {r.nombre} ({r.legajo})</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-[#94a1ab] flex items-center gap-1">
                Turno {guardado === e.legajo && <span className="text-[#16a34a] normal-case tracking-normal">✓ guardado</span>}
              </label>
              <select value={e.horario_id || ""} onChange={(ev) => cambiarCampo(e.legajo, "horario_id", ev.target.value || null)}
                className="bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2.5 py-2 text-xs outline-none max-w-[220px]">
                <option value="">— Sin turno —</option>
                {horarios.map((h) => <option key={h.id} value={h.id}>{h.nombre}</option>)}
              </select>
            </div>
          </div>
        ))}
        {lista.length === 0 && <p className="text-[#94a1ab] text-sm italic">No se encontraron empleados.</p>}
      </div>
    </div>
  );
}
