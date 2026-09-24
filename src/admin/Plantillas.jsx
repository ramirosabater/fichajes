import { useState, useEffect } from "react";
import { sbGet, sbPost, sbPatch, sbDelete, registrarAuditoria } from "./supabase-admin.js";

const DIAS = [
  { n: 1, l: "L" }, { n: 2, l: "M" }, { n: 3, l: "X" }, { n: 4, l: "J" },
  { n: 5, l: "V" }, { n: 6, l: "S" }, { n: 7, l: "D" },
];

export default function Plantillas() {
  const [horarios, setHorarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null); // id que se está editando, o null

  // form
  const [nombre, setNombre] = useState("");
  const [tolerancia, setTolerancia] = useState(10);
  const [dias, setDias] = useState([1, 2, 3, 4, 5]);
  const [inicio, setInicio] = useState("08:00");
  const [fin, setFin] = useState("17:00");
  const [bloques, setBloques] = useState([]);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true); setError(null);
    try { setHorarios(await sbGet("horarios?select=*&order=nombre.asc")); }
    catch { setError("No se pudieron cargar los horarios."); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const toggleDia = (n) => setDias((d) => d.includes(n) ? d.filter((x) => x !== n) : [...d, n].sort());

  const agregarBloque = () => {
    if (!dias.length) return alert("Elegí al menos un día.");
    setBloques((b) => [...b, { dias: [...dias], inicio, fin }]);
  };

  const limpiar = () => {
    setEditando(null); setNombre(""); setTolerancia(10);
    setDias([1, 2, 3, 4, 5]); setInicio("08:00"); setFin("17:00"); setBloques([]);
  };

  const abrirNuevo = () => { limpiar(); setMostrarForm(true); };
  const cancelar = () => { limpiar(); setMostrarForm(false); };

  const editar = (h) => {
    setEditando(h.id);
    setNombre(h.nombre || "");
    setTolerancia(h.tolerancia_minutos ?? 10);
    setBloques(Array.isArray(h.bloques) ? h.bloques.map((b) => ({ dias: [...(b.dias || [])], inicio: b.inicio, fin: b.fin })) : []);
    setDias([1, 2, 3, 4, 5]); setInicio("08:00"); setFin("17:00");
    setMostrarForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const guardar = async () => {
    const bloquesFinales = bloques.length ? bloques : (dias.length ? [{ dias: [...dias], inicio, fin }] : []);
    if (!nombre.trim()) return alert("Poné un nombre.");
    if (!bloquesFinales.length) return alert("Agregá al menos un bloque de horario.");
    setGuardando(true);
    try {
      const datos = { nombre: nombre.trim(), bloques: bloquesFinales, tolerancia_minutos: Number(tolerancia) || 0 };
      if (editando) {
        await sbPatch(`horarios?id=eq.${editando}`, datos);
        setHorarios((h) => h.map((x) => (x.id === editando ? { ...x, ...datos } : x)));
        registrarAuditoria(`Editó el horario "${datos.nombre}"`, null);
      } else {
        const id = `custom_${Date.now()}`;
        const [creado] = await sbPost("horarios", { id, ...datos });
        setHorarios((h) => [...h, creado]);
        registrarAuditoria(`Creó el horario "${datos.nombre}"`, null);
      }
      limpiar(); setMostrarForm(false);
    } catch { alert("No se pudo guardar el horario."); }
    finally { setGuardando(false); }
  };

  const borrar = async (id, nom) => {
    if (!confirm(`¿Borrar el horario "${nom}"? Los empleados que lo tenían quedan sin turno.`)) return;
    try { await sbDelete(`horarios?id=eq.${id}`); setHorarios((h) => h.filter((x) => x.id !== id)); registrarAuditoria(`Borró el horario "${nom}"`, null); }
    catch { alert("No se pudo borrar."); }
  };

  if (cargando) return <p className="text-[#5c6b78] text-center py-16">Cargando…</p>;
  if (error) return <p className="text-[#e5484d] text-center py-10">{error}</p>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold">Horarios de turnos</h2>
        <button onClick={() => (mostrarForm ? cancelar() : abrirNuevo())} className="px-3 py-2 rounded-lg text-sm font-bold bg-[#223c7e] text-white">
          {mostrarForm ? "Cancelar" : "+ Nuevo horario"}
        </button>
      </div>

      {mostrarForm && (
        <div className="bg-[#ffffff] border border-[#e3e8ed] rounded-xl p-4 mb-5 shadow-sm">
          <p className="text-sm font-bold mb-3">{editando ? "Editar horario" : "Nuevo horario"}</p>
          <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Mañana Lun-Vie"
            className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2 text-sm outline-none mb-3 mt-1" />

          <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Días</label>
          <div className="flex gap-1.5 my-1 mb-3">
            {DIAS.map((d) => (
              <button key={d.n} onClick={() => toggleDia(d.n)}
                className="w-8 h-8 rounded-lg text-xs font-bold border"
                style={{ backgroundColor: dias.includes(d.n) ? "#223c7e" : "#f1f4f7", color: dias.includes(d.n) ? "#ffffff" : "#5c6b78", borderColor: dias.includes(d.n) ? "#223c7e" : "#cfd6dd" }}>
                {d.l}
              </button>
            ))}
          </div>

          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Entrada</label>
              <input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2 text-sm outline-none mt-1" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Salida</label>
              <input type="time" value={fin} onChange={(e) => setFin(e.target.value)} className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2 text-sm outline-none mt-1" />
            </div>
            <div className="w-24">
              <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Toler. (min)</label>
              <input type="number" value={tolerancia} onChange={(e) => setTolerancia(e.target.value)} className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2 text-sm outline-none mt-1" />
            </div>
          </div>

          <button onClick={agregarBloque} className="text-xs text-[#223c7e] mb-2">+ Agregar este bloque (para días con horario distinto)</button>
          {bloques.length > 0 && (
            <div className="mb-3 space-y-1">
              {bloques.map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-[#5c6b78] bg-[#f1f4f7] rounded-lg px-2 py-1">
                  <span>{b.dias.map((n) => DIAS.find((d) => d.n === n)?.l).join("")} · {b.inicio}–{b.fin}</span>
                  <button onClick={() => setBloques((bs) => bs.filter((_, j) => j !== i))} className="text-[#e5484d]">✕</button>
                </div>
              ))}
            </div>
          )}
          {bloques.length === 0 && <p className="text-[11px] text-[#94a1ab] mb-3">Si no agregás bloques, se usa el día/horario de arriba. Para un turno partido o días con horarios distintos, agregá cada bloque.</p>}

          <button onClick={guardar} disabled={guardando} className="w-full py-2.5 rounded-lg font-bold text-sm bg-[#16a34a] text-white disabled:opacity-50">
            {guardando ? "Guardando…" : (editando ? "Guardar cambios" : "Guardar horario")}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {horarios.length === 0 && <p className="text-[#94a1ab] text-sm italic">No hay horarios todavía.</p>}
        {horarios.map((h) => (
          <div key={h.id} className="bg-[#ffffff] border border-[#e3e8ed] rounded-xl p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{h.nombre}</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {(h.bloques || []).map((b, i) => (
                  <span key={i} className="text-[11px] text-[#5c6b78] bg-[#f1f4f7] rounded px-1.5 py-0.5">
                    {(b.dias || []).map((n) => DIAS.find((d) => d.n === n)?.l).join("")} {b.inicio}–{b.fin}
                  </span>
                ))}
                <span className="text-[11px] text-[#94a1ab]">· tol. {h.tolerancia_minutos ?? 0}m</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => editar(h)} className="text-xs text-[#223c7e] px-2 py-1 rounded-lg border border-[#223c7e]/40">Editar</button>
              <button onClick={() => borrar(h.id, h.nombre)} className="text-xs text-[#e5484d] px-2 py-1 rounded-lg border border-[#e5484d]/40">Borrar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
