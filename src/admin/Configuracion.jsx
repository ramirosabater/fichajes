import { useState, useEffect } from "react";
import { sbGet, sbPost, sbDelete } from "./supabase-admin.js";

const DIAS = [
  { n: 1, l: "L" }, { n: 2, l: "M" }, { n: 3, l: "X" }, { n: 4, l: "J" },
  { n: 5, l: "V" }, { n: 6, l: "S" }, { n: 7, l: "D" },
];
const dlabel = (arr) => (arr || []).map((n) => DIAS.find((d) => d.n === n)?.l).join("");

export default function Configuracion() {
  const [recargos, setRecargos] = useState([]);
  const [feriados, setFeriados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // form recargo
  const [rDias, setRDias] = useState([6]);
  const [rDesde, setRDesde] = useState("13:00");
  const [rHasta, setRHasta] = useState("24:00");
  const [rPct, setRPct] = useState(100);

  // form feriado
  const [fFecha, setFFecha] = useState("");
  const [fNombre, setFNombre] = useState("");
  const [fPct, setFPct] = useState(100);

  const cargar = async () => {
    setCargando(true); setError(null);
    try {
      const [rec, fer] = await Promise.all([
        sbGet("recargos?select=*&order=porcentaje.desc"),
        sbGet("feriados?select=*&order=fecha.asc"),
      ]);
      setRecargos(rec); setFeriados(fer);
    } catch { setError("No se pudo cargar la configuración. ¿Corriste setup-recargos.sql?"); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const toggleDia = (n) => setRDias((d) => d.includes(n) ? d.filter((x) => x !== n) : [...d, n].sort());

  const agregarRecargo = async () => {
    if (!rDias.length) return alert("Elegí al menos un día.");
    try {
      await sbPost("recargos", { dias: rDias, hora_desde: rDesde, hora_hasta: rHasta, porcentaje: Number(rPct) });
      await cargar();
    } catch { alert("No se pudo guardar la regla."); }
  };
  const borrarRecargo = async (id) => {
    if (!confirm("¿Borrar esta regla de recargo?")) return;
    try { await sbDelete(`recargos?id=eq.${id}`); setRecargos((r) => r.filter((x) => x.id !== id)); }
    catch { alert("No se pudo borrar."); }
  };

  const agregarFeriado = async () => {
    if (!fFecha) return alert("Elegí una fecha.");
    try {
      await sbPost("feriados", { fecha: fFecha, nombre: fNombre.trim() || null, porcentaje: Number(fPct) });
      setFFecha(""); setFNombre(""); await cargar();
    } catch { alert("No se pudo guardar el feriado (¿fecha repetida?)."); }
  };
  const borrarFeriado = async (fecha) => {
    try { await sbDelete(`feriados?fecha=eq.${fecha}`); setFeriados((f) => f.filter((x) => x.fecha !== fecha)); }
    catch { alert("No se pudo borrar."); }
  };

  if (cargando) return <p className="text-[#5c6b78] text-center py-16">Cargando…</p>;
  if (error) return <p className="text-[#e5484d] text-center py-10">{error}</p>;

  return (
    <div className="max-w-2xl space-y-6">
      {/* RECARGOS */}
      <div className="bg-[#ffffff] border border-[#e3e8ed] rounded-2xl p-5">
        <h2 className="text-base font-bold mb-1">Recargos de horas (50% / 100%)</h2>
        <p className="text-[#94a1ab] text-xs mb-4">Definí qué días y horas se pagan con recargo. Las horas trabajadas dentro de una ventana suman a ese porcentaje.</p>

        <div className="space-y-2 mb-4">
          {recargos.length === 0 && <p className="text-[#94a1ab] text-sm italic">No hay reglas cargadas.</p>}
          {recargos.map((r) => (
            <div key={r.id} className="flex items-center gap-3 bg-[#f1f4f7] border border-[#e3e8ed] rounded-lg px-3 py-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: r.porcentaje >= 100 ? "rgba(229,72,77,.15)" : "rgba(43,169,224,.15)", color: r.porcentaje >= 100 ? "#e5484d" : "#2ba9e0" }}>{r.porcentaje}%</span>
              <span className="flex-1 text-sm">{dlabel(r.dias)} · {r.hora_desde}–{r.hora_hasta}</span>
              <button onClick={() => borrarRecargo(r.id)} className="text-xs text-[#e5484d]">Borrar</button>
            </div>
          ))}
        </div>

        <div className="border-t border-[#e3e8ed] pt-4">
          <p className="text-[10px] uppercase tracking-widest text-[#94a1ab] mb-2">Nueva regla</p>
          <div className="flex gap-1.5 mb-3">
            {DIAS.map((d) => (
              <button key={d.n} onClick={() => toggleDia(d.n)} className="w-8 h-8 rounded-lg text-xs font-bold border"
                style={{ backgroundColor: rDias.includes(d.n) ? "#e1251b" : "#f1f4f7", color: rDias.includes(d.n) ? "#ffffff" : "#5c6b78", borderColor: rDias.includes(d.n) ? "#e1251b" : "#cfd6dd" }}>{d.l}</button>
            ))}
          </div>
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Desde</label>
              <input type="time" value={rDesde} onChange={(e) => setRDesde(e.target.value)} className="block bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2 text-sm outline-none mt-1" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Hasta</label>
              <input type="time" value={rHasta === "24:00" ? "23:59" : rHasta} onChange={(e) => setRHasta(e.target.value === "23:59" ? "24:00" : e.target.value)} className="block bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2 text-sm outline-none mt-1" />
            </div>
            <div className="flex gap-1">
              {[50, 100].map((p) => (
                <button key={p} onClick={() => setRPct(p)} className="px-3 py-2 rounded-lg text-sm font-bold border"
                  style={{ backgroundColor: rPct === p ? "#e1251b" : "#f1f4f7", color: rPct === p ? "#ffffff" : "#5c6b78", borderColor: rPct === p ? "#e1251b" : "#cfd6dd" }}>{p}%</button>
              ))}
            </div>
            <button onClick={agregarRecargo} className="px-4 py-2 rounded-lg text-sm font-bold bg-[#16a34a] text-white">+ Agregar</button>
          </div>
          <p className="text-[10px] text-[#94a1ab] mt-2">Tip: para "hasta fin del día" poné 23:59 (se toma como 24:00).</p>
        </div>
      </div>

      {/* FERIADOS */}
      <div className="bg-[#ffffff] border border-[#e3e8ed] rounded-2xl p-5">
        <h2 className="text-base font-bold mb-1">Feriados</h2>
        <p className="text-[#94a1ab] text-xs mb-4">Los días marcados acá aplican el recargo indicado a todas las horas trabajadas.</p>

        <div className="flex gap-2 items-end flex-wrap mb-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Fecha</label>
            <input type="date" value={fFecha} onChange={(e) => setFFecha(e.target.value)} className="block bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2 text-sm outline-none mt-1" />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Nombre (opcional)</label>
            <input value={fNombre} onChange={(e) => setFNombre(e.target.value)} placeholder="Ej: Día del trabajador" className="block w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2 text-sm outline-none mt-1" />
          </div>
          <div className="flex gap-1">
            {[50, 100].map((p) => (
              <button key={p} onClick={() => setFPct(p)} className="px-3 py-2 rounded-lg text-sm font-bold border"
                style={{ backgroundColor: fPct === p ? "#e1251b" : "#f1f4f7", color: fPct === p ? "#ffffff" : "#5c6b78", borderColor: fPct === p ? "#e1251b" : "#cfd6dd" }}>{p}%</button>
            ))}
          </div>
          <button onClick={agregarFeriado} className="px-4 py-2 rounded-lg text-sm font-bold bg-[#16a34a] text-white">+ Agregar</button>
        </div>

        <div className="space-y-1">
          {feriados.length === 0 && <p className="text-[#94a1ab] text-sm italic">No hay feriados cargados.</p>}
          {feriados.map((f) => (
            <div key={f.fecha} className="flex items-center gap-3 bg-[#f1f4f7] border border-[#e3e8ed] rounded-lg px-3 py-2">
              <span className="text-sm tabular-nums">{new Date(f.fecha + "T00:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" })}</span>
              <span className="flex-1 text-sm text-[#5c6b78]">{f.nombre || ""}</span>
              <span className="text-xs font-bold" style={{ color: f.porcentaje >= 100 ? "#e5484d" : "#2ba9e0" }}>{f.porcentaje}%</span>
              <button onClick={() => borrarFeriado(f.fecha)} className="text-xs text-[#e5484d]">Borrar</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
