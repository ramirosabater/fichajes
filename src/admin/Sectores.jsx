import { useState, useEffect } from "react";
import { sbGet, sbPost, sbPatch, sbDelete } from "./supabase-admin.js";

export default function Sectores() {
  const [sectores, setSectores] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [nuevo, setNuevo] = useState("");
  const [msg, setMsg] = useState(null);

  const cargar = async () => {
    setCargando(true); setError(null);
    try {
      const [sec, emps] = await Promise.all([
        sbGet("sectores?select=*&order=nombre.asc"),
        sbGet("empleados?select=legajo,sector"),
      ]);
      setSectores(sec); setEmpleados(emps);
    } catch {
      setError("No se pudieron cargar los sectores. ¿Corriste setup-sectores.sql?");
    } finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const contar = (nombre) => empleados.filter((e) => e.sector === nombre).length;
  const flash = (t, ok) => { setMsg({ t, ok }); setTimeout(() => setMsg((m) => (m?.t === t ? null : m)), 2500); };

  const agregar = async () => {
    const nombre = nuevo.trim();
    if (!nombre) return;
    if (sectores.some((s) => s.nombre.toLowerCase() === nombre.toLowerCase())) return flash("Ese sector ya existe.", false);
    try { await sbPost("sectores", { nombre }); setNuevo(""); await cargar(); flash("Sector agregado.", true); }
    catch { flash("No se pudo agregar.", false); }
  };

  const renombrar = async (s) => {
    const nv = prompt(`Nuevo nombre para "${s.nombre}":`, s.nombre);
    if (!nv || !nv.trim() || nv.trim() === s.nombre) return;
    const nombre = nv.trim();
    try {
      await sbPatch(`sectores?id=eq.${s.id}`, { nombre });
      await sbPatch(`empleados?sector=eq.${encodeURIComponent(s.nombre)}`, { sector: nombre });
      await cargar(); flash("Sector renombrado.", true);
    } catch { flash("No se pudo renombrar.", false); }
  };

  const borrar = async (s) => {
    const n = contar(s.nombre);
    const ok = n > 0
      ? confirm(`"${s.nombre}" tiene ${n} empleado(s). Si lo borrás, quedan sin sector. ¿Continuar?`)
      : confirm(`¿Borrar "${s.nombre}"?`);
    if (!ok) return;
    try {
      if (n > 0) await sbPatch(`empleados?sector=eq.${encodeURIComponent(s.nombre)}`, { sector: null });
      await sbDelete(`sectores?id=eq.${s.id}`);
      await cargar(); flash("Sector borrado.", true);
    } catch { flash("No se pudo borrar.", false); }
  };

  if (cargando) return <p className="text-[#5c6b78] text-center py-16">Cargando…</p>;
  if (error) return <p className="text-[#e5484d] text-center py-10">{error}</p>;

  return (
    <div className="max-w-lg">
      <h2 className="text-base font-bold mb-4">Sectores</h2>
      <div className="bg-[#ffffff] border border-[#e3e8ed] rounded-xl p-4">
        <div className="flex gap-2">
          <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && agregar()}
            placeholder="Nombre del nuevo sector"
            className="flex-1 bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2 text-sm outline-none" />
          <button onClick={agregar} className="px-4 rounded-lg font-bold text-sm bg-[#e1251b] text-white">Agregar</button>
        </div>
        {msg && <p className={`text-xs mt-2 ${msg.ok ? "text-[#16a34a]" : "text-[#e5484d]"}`}>{msg.t}</p>}

        <div className="mt-4 divide-y divide-[#f1f4f7]">
          {sectores.length === 0 && <p className="text-[#94a1ab] text-sm italic py-3">No hay sectores. Agregá el primero.</p>}
          {sectores.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2.5">
              <span className="flex-1 font-medium text-sm">{s.nombre}</span>
              <span className="text-xs text-[#5c6b78] bg-[#f1f4f7] px-2 py-0.5 rounded">{contar(s.nombre)} emp.</span>
              <button onClick={() => renombrar(s)} className="text-xs text-[#5c6b78] hover:text-[#1f2d38] px-2 py-1 rounded-lg border border-[#cfd6dd]">Renombrar</button>
              <button onClick={() => borrar(s)} className="text-xs text-[#e5484d] px-2 py-1 rounded-lg border border-[#e5484d]/40">Borrar</button>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-[#94a1ab] mt-3">La asignación de sector a cada empleado se hace en la pestaña <b>Empleados</b>.</p>
    </div>
  );
}
