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
  const [libre, setLibre] = useState(false);
  const [horasDiarias, setHorasDiarias] = useState(8);
  const [horasSabado, setHorasSabado] = useState(4);
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
    setLibre(false); setHorasDiarias(8); setHorasSabado(4);
  };

  const abrirNuevo = () => { limpiar(); setMostrarForm(true); };
  const cancelar = () => { limpiar(); setMostrarForm(false); };

  const editar = (h) => {
    setEditando(h.id);
    setNombre(h.nombre || "");
    setTolerancia(h.tolerancia_minutos ?? 10);
    setLibre(h.tipo === "libre");
    setHorasDiarias(h.horas_diarias ?? 8);
    setHorasSabado(h.horas_sabado ?? 4);
    if (h.tipo === "libre") {
      const ds = new Set(); (h.bloques || []).forEach((b) => (b.dias || []).forEach((d) => ds.add(d)));
      setBloques([]); setDias([...ds].sort());
      setMostrarForm(true); window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setBloques(Array.isArray(h.bloques) ? h.bloques.map((b) => ({ dias: [...(b.dias || [])], inicio: b.inicio, fin: b.fin })) : []);
    setDias([1, 2, 3, 4, 5]); setInicio("08:00"); setFin("17:00");
    setMostrarForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const guardar = async () => {
    if (!nombre.trim()) return alert("Poné un nombre.");
    if (libre && !dias.length) return alert("Elegí al menos un día laborable.");
    if (libre && !(Number(horasDiarias) > 0)) return alert("Indicá las horas diarias (mayor a 0).");
    if (libre && dias.includes(6) && !(Number(horasSabado) >= 0)) return alert("Indicá las horas del sábado.");
    // Horario libre: un bloque solo con días (sin hora de inicio/fin); lo que cuenta son las horas trabajadas.
    const bloquesFinales = libre
      ? [{ dias: [...dias] }]
      : (bloques.length ? bloques : (dias.length ? [{ dias: [...dias], inicio, fin }] : []));
    if (!bloquesFinales.length) return alert("Agregá al menos un bloque de horario.");
    setGuardando(true);
    try {
      const datos = {
        nombre: nombre.trim(), bloques: bloquesFinales, tolerancia_minutos: libre ? 0 : (Number(tolerancia) || 0),
        tipo: libre ? "libre" : "fijo", horas_diarias: libre ? Number(horasDiarias) : null,
        horas_sabado: libre ? Number(horasSabado) : null,
      };
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

          <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Tipo</label>
          <div className="flex gap-1.5 my-1 mb-3">
            {[{ v: false, l: "Fijo (con horas de entrada/salida)" }, { v: true, l: "Libre (cuenta horas trabajadas)" }].map((o) => (
              <button key={String(o.v)} onClick={() => setLibre(o.v)} className="px-3 py-2 rounded-lg text-xs font-bold border"
                style={{ backgroundColor: libre === o.v ? "#223c7e" : "#f1f4f7", color: libre === o.v ? "#ffffff" : "#5c6b78", borderColor: libre === o.v ? "#223c7e" : "#cfd6dd" }}>
                {o.l}
              </button>
            ))}
          </div>

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

          {libre && (
            <div className="mb-3">
              <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Horas diarias a cumplir</label>
              <input type="number" min="0" step="0.5" value={horasDiarias} onChange={(e) => setHorasDiarias(e.target.value)}
                className="w-32 block bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2 text-sm outline-none mt-1" />
              {dias.includes(6) && (<>
                <label className="text-[10px] uppercase tracking-wider text-[#94a1ab] block mt-3">Horas los sábados</label>
                <input type="number" min="0" step="0.5" value={horasSabado} onChange={(e) => setHorasSabado(e.target.value)}
                  className="w-32 block bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2 text-sm outline-none mt-1" />
              </>)}
              <p className="text-[11px] text-[#94a1ab] mt-1">No hay llegada tarde ni salida anticipada: se suman las horas entre cada entrada y salida y se comparan con la meta del período.</p>
            </div>
          )}
          {!libre && (<>
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
          </>)}

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
                {h.tipo === "libre" && <span className="text-[11px] font-bold text-[#223c7e] bg-[#e8eefb] rounded px-1.5 py-0.5">LIBRE · {h.horas_diarias ?? "?"} h/día{(h.bloques || []).some((b) => (b.dias || []).includes(6)) ? ` · sáb ${h.horas_sabado ?? 4} h` : ""}</span>}
                {(h.bloques || []).map((b, i) => (
                  <span key={i} className="text-[11px] text-[#5c6b78] bg-[#f1f4f7] rounded px-1.5 py-0.5">
                    {(b.dias || []).map((n) => DIAS.find((d) => d.n === n)?.l).join("")}{b.inicio ? ` ${b.inicio}–${b.fin}` : ""}
                  </span>
                ))}
                {h.tipo !== "libre" && <span className="text-[11px] text-[#94a1ab]">· tol. {h.tolerancia_minutos ?? 0}m</span>}
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
