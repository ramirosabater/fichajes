import { useState, useEffect } from "react";
import { sbGet, sbPost, sbPatch, sbDelete } from "./supabase-admin.js";
import { calcularPeriodo, etiquetaPeriodo, calcularEstado } from "../lib/fichaje.js";

// Convierte un input datetime-local a Date, y una Date a valor de input
const aInput = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function Fichadas() {
  const [empleados, setEmpleados] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [legajo, setLegajo] = useState("");
  const [refMes, setRefMes] = useState(new Date());
  const [fichajes, setFichajes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  // form nueva fichada
  const [nTipo, setNTipo] = useState("entrada");
  const [nCuando, setNCuando] = useState(aInput(new Date()));

  useEffect(() => {
    (async () => {
      try {
        const [emps, hs] = await Promise.all([
          sbGet("empleados?select=legajo,apellido,nombre,horario_id&order=apellido.asc"),
          sbGet("horarios?select=*"),
        ]);
        setEmpleados(emps); setHorarios(hs);
      } catch { setError("No se pudieron cargar los datos."); }
    })();
  }, []);

  const empleado = empleados.find((e) => String(e.legajo) === String(legajo));
  const horario = empleado ? horarios.find((h) => String(h.id) === String(empleado.horario_id)) : null;
  const { desde, hasta } = calcularPeriodo(refMes);

  const cargarFichajes = async () => {
    if (!legajo) { setFichajes([]); return; }
    setCargando(true); setError(null);
    try {
      const r = await sbGet(`fichajes?legajo=eq.${legajo}&timestamp=gte.${desde.toISOString()}&timestamp=lte.${hasta.toISOString()}&order=timestamp.desc&limit=1000`);
      setFichajes(r);
    } catch { setError("No se pudieron cargar las fichadas."); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargarFichajes(); /* eslint-disable-next-line */ }, [legajo, refMes]);

  const estadoDe = (tipo, fecha) => {
    const est = calcularEstado(tipo, fecha, horario);
    return { estado: est.estado, minutos_tarde: est.minutosTarde || 0 };
  };

  const agregar = async () => {
    if (!legajo) return alert("Elegí un empleado.");
    const fecha = new Date(nCuando);
    if (isNaN(fecha)) return alert("Fecha/hora inválida.");
    const e = estadoDe(nTipo, fecha);
    try {
      await sbPost("fichajes", {
        legajo: Number(legajo), tipo: nTipo, timestamp: fecha.toISOString(),
        estado: e.estado, minutos_tarde: e.minutos_tarde,
        user_agent: "Corrección manual (admin)", device_id: null,
      });
      await cargarFichajes();
    } catch { alert("No se pudo agregar la fichada."); }
  };

  const editar = async (f, campo, valor) => {
    const nuevo = { ...f, [campo]: valor };
    const fecha = campo === "timestamp" ? new Date(valor) : new Date(f.timestamp);
    const tipo = campo === "tipo" ? valor : f.tipo;
    if (campo === "timestamp" && isNaN(fecha)) return;
    const e = estadoDe(tipo, fecha);
    const patch = campo === "timestamp"
      ? { timestamp: fecha.toISOString(), estado: e.estado, minutos_tarde: e.minutos_tarde }
      : { tipo, estado: e.estado, minutos_tarde: e.minutos_tarde };
    setFichajes((fs) => fs.map((x) => (x.id === f.id ? { ...x, ...patch } : x)));
    try { await sbPatch(`fichajes?id=eq.${f.id}`, patch); }
    catch { alert("No se pudo guardar."); cargarFichajes(); }
  };

  const borrar = async (f) => {
    if (!confirm("¿Borrar esta fichada?")) return;
    try { await sbDelete(`fichajes?id=eq.${f.id}`); setFichajes((fs) => fs.filter((x) => x.id !== f.id)); }
    catch { alert("No se pudo borrar."); }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-base font-bold mb-1">Corrección de fichadas</h2>
      <p className="text-[#94a1ab] text-xs mb-4">Elegí un empleado para ver, editar, agregar o borrar sus fichadas del período.</p>

      <div className="flex gap-3 flex-wrap mb-4">
        <select value={legajo} onChange={(e) => setLegajo(e.target.value)} className="flex-1 min-w-[200px] bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2 text-sm outline-none">
          <option value="">— Elegí un empleado —</option>
          {empleados.map((e) => <option key={e.legajo} value={e.legajo}>{e.apellido}, {e.nombre} ({e.legajo})</option>)}
        </select>
        <div className="rounded-lg bg-[#f1f4f7] border border-[#cfd6dd] px-2 flex items-center">
          <button onClick={() => setRefMes((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="text-[#5c6b78] px-2 text-lg">‹</button>
          <span className="text-xs font-semibold px-1">{etiquetaPeriodo(desde, hasta)}</span>
          <button onClick={() => setRefMes((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="text-[#5c6b78] px-2 text-lg">›</button>
        </div>
      </div>

      {legajo && (
        <div className="bg-white border border-[#e3e8ed] rounded-xl p-3 mb-4 shadow-sm flex gap-2 items-end flex-wrap">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Tipo</label>
            <select value={nTipo} onChange={(e) => setNTipo(e.target.value)} className="block bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2.5 py-2 text-sm outline-none mt-1">
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Fecha y hora</label>
            <input type="datetime-local" value={nCuando} onChange={(e) => setNCuando(e.target.value)} className="block bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2.5 py-2 text-sm outline-none mt-1" />
          </div>
          <button onClick={agregar} className="px-4 py-2 rounded-lg font-bold text-sm bg-[#16a34a] text-white">+ Agregar fichada</button>
        </div>
      )}

      {error && <p className="text-[#e5484d] text-sm mb-3">{error}</p>}
      {cargando ? (
        <p className="text-[#5c6b78] text-center py-10">Cargando…</p>
      ) : !legajo ? null : fichajes.length === 0 ? (
        <p className="text-[#94a1ab] text-sm italic">No hay fichadas en este período.</p>
      ) : (
        <div className="space-y-2">
          {fichajes.map((f) => (
            <div key={f.id} className="bg-white border border-[#e3e8ed] rounded-xl p-3 flex items-center gap-2 flex-wrap shadow-sm">
              <select value={f.tipo} onChange={(e) => editar(f, "tipo", e.target.value)} className="bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2 py-1.5 text-xs outline-none">
                <option value="entrada">🟢 Entrada</option>
                <option value="salida">🔴 Salida</option>
              </select>
              <input type="datetime-local" defaultValue={aInput(new Date(f.timestamp))} onBlur={(e) => editar(f, "timestamp", e.target.value)}
                className="bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2 py-1.5 text-xs outline-none" />
              <span className="text-[11px] px-2 py-1 rounded" style={{
                backgroundColor: f.estado === "tarde" ? "rgba(229,72,77,.1)" : f.estado === "salida_anticipada" ? "rgba(225,37,27,.1)" : "rgba(22,163,74,.1)",
                color: f.estado === "tarde" || f.estado === "salida_anticipada" ? "#e5484d" : "#16a34a",
              }}>{f.estado}{f.minutos_tarde ? ` ${f.minutos_tarde}m` : ""}</span>
              {f.user_agent === "Corrección manual (admin)" && <span className="text-[10px] text-[#94a1ab]">✎ manual</span>}
              <button onClick={() => borrar(f)} className="ml-auto text-xs text-[#e5484d] px-2 py-1 rounded-lg border border-[#e5484d]/40">Borrar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
