import { useState, useEffect } from "react";
import { sbGet, sbPost, sbDelete, registrarAuditoria } from "./supabase-admin.js";

const DIAS = [
  { n: 1, l: "L" }, { n: 2, l: "M" }, { n: 3, l: "X" }, { n: 4, l: "J" },
  { n: 5, l: "V" }, { n: 6, l: "S" }, { n: 7, l: "D" },
];

export default function Plantillas() {
  const [plantillas, setPlantillas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);

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
    try { setPlantillas(await sbGet("horarios?select=*&order=nombre.asc")); }
    catch { setError("No se pudieron cargar las plantillas."); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const toggleDia = (n) => setDias((d) => d.includes(n) ? d.filter((x) => x !== n) : [...d, n].sort());

  const mismoBloque = (a, b) =>
    a.inicio === b.inicio && a.fin === b.fin &&
    (a.dias || []).length === (b.dias || []).length && (a.dias || []).every((d) => (b.dias || []).includes(d));

  // Dos tramos "chocan" si comparten al menos un día y sus horarios se superponen.
  const seSuperponen = (a, b) => {
    if (!(a.dias || []).some((d) => (b.dias || []).includes(d))) return false;
    const [ai, af] = [a.inicio, a.fin], [bi, bf] = [b.inicio, b.fin];
    return ai < bf && bi < af;
  };

  const agregarBloque = () => {
    if (!dias.length) return alert("Elegí al menos un día.");
    if (inicio >= fin) return alert("La salida tiene que ser después de la entrada.");
    const nuevo = { dias: [...dias], inicio, fin };
    if (bloques.some((b) => seSuperponen(b, nuevo))) return alert("Ese tramo se superpone con uno ya agregado, para alguno de esos días.");
    setBloques((b) => [...b, nuevo]);
  };

  // Para un turno partido con un solo bloque a la vez alcanza con completar los
  // campos y tocar "Guardar plantilla" (no hace falta tocar "+ Agregar otro
  // bloque"). Si se agregaron varios tramos con "+ Agregar otro bloque" y además
  // quedaron valores cargados en los campos que todavía no se agregaron, también
  // se incluyen al guardar, para no perderlos.
  const guardar = async () => {
    const actual = (dias.length && inicio && fin) ? { dias: [...dias], inicio, fin } : null;
    const yaEstaba = actual && bloques.some((b) => mismoBloque(b, actual));
    const bloquesFinales = actual && !yaEstaba ? [...bloques, actual] : bloques;
    if (!nombre.trim()) return alert("Poné un nombre.");
    if (!bloquesFinales.length) return alert("Agregá al menos un bloque de horario.");
    if (actual && inicio >= fin) return alert("La salida tiene que ser después de la entrada.");
    for (let i = 0; i < bloquesFinales.length; i++) {
      for (let j = i + 1; j < bloquesFinales.length; j++) {
        if (seSuperponen(bloquesFinales[i], bloquesFinales[j])) return alert("Hay dos tramos que se superponen para el mismo día. Revisalos antes de guardar.");
      }
    }
    setGuardando(true);
    try {
      const id = `custom_${Date.now()}`;
      const [creada] = await sbPost("horarios", { id, nombre: nombre.trim(), bloques: bloquesFinales, tolerancia_minutos: Number(tolerancia) || 0 });
      setPlantillas((p) => [...p, creada]);
      registrarAuditoria(`Creó la plantilla "${nombre.trim()}"`, null);
      cerrarForm();
    } catch { alert("No se pudo crear la plantilla."); }
    finally { setGuardando(false); }
  };

  const cerrarForm = () => {
    setNombre(""); setTolerancia(10); setDias([1, 2, 3, 4, 5]); setInicio("08:00"); setFin("17:00");
    setBloques([]); setMostrarForm(false);
  };

  const borrar = async (id, nom) => {
    if (!confirm(`¿Borrar la plantilla "${nom}"? Los empleados que la tenían quedan sin turno.`)) return;
    try { await sbDelete(`horarios?id=eq.${id}`); setPlantillas((p) => p.filter((x) => x.id !== id)); registrarAuditoria(`Borró la plantilla "${nom}"`, null); }
    catch { alert("No se pudo borrar."); }
  };

  if (cargando) return <p className="text-[#5c6b78] text-center py-16">Cargando…</p>;
  if (error) return <p className="text-[#e5484d] text-center py-10">{error}</p>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold">Plantillas de turnos</h2>
        <button onClick={() => (mostrarForm ? cerrarForm() : setMostrarForm(true))} className="px-3 py-2 rounded-lg text-sm font-bold bg-[#223c7e] text-white">
          {mostrarForm ? "Cancelar" : "+ Nueva plantilla"}
        </button>
      </div>

      {mostrarForm && (
        <div className="bg-[#ffffff] border border-[#e3e8ed] rounded-xl p-4 mb-5">
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

          <button onClick={agregarBloque} className="text-xs text-[#223c7e] mb-1">+ Agregar otro bloque</button>
          <p className="text-[11px] text-[#94a1ab] mb-2">
            Usalo para <b>turnos partidos</b> (ej. mismos días, entrada y salida al mediodía y otra vez a la tarde)
            o para días con un horario distinto. Cargá el primer tramo, tocá acá para agregarlo, y completá el
            siguiente tramo antes de guardar.
          </p>
          {bloques.length > 0 && (
            <div className="mb-3 space-y-1">
              {bloques.map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-[#5c6b78] bg-[#f1f4f7] rounded-lg px-2 py-1">
                  <span>{b.dias.map((n) => DIAS.find((d) => d.n === n).l).join("")} · {b.inicio}–{b.fin}</span>
                  <button onClick={() => setBloques((bs) => bs.filter((_, j) => j !== i))} className="text-[#e5484d]">✕</button>
                </div>
              ))}
            </div>
          )}

          <button onClick={guardar} disabled={guardando} className="w-full py-2.5 rounded-lg font-bold text-sm bg-[#16a34a] text-white disabled:opacity-50">
            {guardando ? "Guardando…" : "Guardar plantilla"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {plantillas.length === 0 && <p className="text-[#94a1ab] text-sm italic">No hay plantillas todavía.</p>}
        {plantillas.map((p) => (
          <div key={p.id} className="bg-[#ffffff] border border-[#e3e8ed] rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{p.nombre}{(p.bloques || []).length > 1 ? " · turno partido" : ""}</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {(p.bloques || []).slice().sort((a, b) => (a.inicio || "").localeCompare(b.inicio || "")).map((b, i) => (
                  <span key={i} className="text-[11px] text-[#5c6b78] bg-[#f1f4f7] rounded px-1.5 py-0.5">
                    {(b.dias || []).map((n) => DIAS.find((d) => d.n === n)?.l).join("")} {b.inicio}–{b.fin}
                  </span>
                ))}
                <span className="text-[11px] text-[#94a1ab]">· tol. {p.tolerancia_minutos ?? 0}m</span>
              </div>
            </div>
            <button onClick={() => borrar(p.id, p.nombre)} className="text-xs text-[#e5484d] px-2 py-1 rounded-lg border border-[#e5484d]/40">Borrar</button>
          </div>
        ))}
      </div>
    </div>
  );
}
