import { useState, useEffect } from "react";
import { sbGet } from "./supabase-admin.js";

export default function Auditoria() {
  const [log, setLog] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState("");

  const cargar = async () => {
    setCargando(true); setError(null);
    try { setLog(await sbGet("auditoria?select=*&order=creado_en.desc&limit=500")); }
    catch { setError("No se pudo cargar la auditoría."); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const lista = log.filter((l) => (`${l.quien} ${l.accion} ${l.detalle || ""}`).toLowerCase().includes(busqueda.toLowerCase()));

  if (cargando) return <p className="text-[#5c6b78] text-center py-16">Cargando…</p>;
  if (error) return <p className="text-[#e5484d] text-center py-10">{error}</p>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-base font-bold">Auditoría de cambios</h2>
        <button onClick={cargar} className="text-xs px-3 py-1.5 rounded-lg border border-[#e3e8ed] bg-white text-[#5c6b78]">↻ Actualizar</button>
      </div>
      <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por usuario o acción…"
        className="w-full max-w-sm mb-4 bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2 text-sm outline-none" />

      {lista.length === 0 ? <p className="text-[#94a1ab] text-sm italic">No hay registros.</p> : (
        <div className="bg-white border border-[#e3e8ed] rounded-xl overflow-hidden shadow-sm divide-y divide-[#f1f4f7]">
          {lista.map((l) => (
            <div key={l.id} className="px-4 py-2.5 flex items-start gap-3">
              <span className="text-[10px] text-[#94a1ab] tabular-nums shrink-0 w-28">{new Date(l.creado_en).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{l.accion}{l.detalle ? <span className="text-[#94a1ab]"> · {l.detalle}</span> : null}</p>
                <p className="text-[10px] text-[#94a1ab]">{l.quien}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
