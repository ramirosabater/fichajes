import { useState, useEffect } from "react";
import { sbGet, sbPost, sbPatch, sbDelete } from "./supabase-admin.js";

export default function Depositos() {
  const [locales, setLocales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ nombre: "", lat: "", lng: "", radio_metros: 150 });
  const [capturando, setCapturando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true); setError(null);
    try { setLocales(await sbGet("locales?select=*&order=nombre.asc")); }
    catch { setError("No se pudieron cargar los depósitos."); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const usarMiUbicacion = () => {
    if (!navigator.geolocation) return alert("Tu navegador no permite geolocalización.");
    setCapturando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setForm((f) => ({ ...f, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) })); setCapturando(false); },
      () => { alert("No se pudo obtener tu ubicación (revisá el permiso)."); setCapturando(false); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const crear = async () => {
    if (!form.nombre.trim()) return alert("Poné un nombre.");
    if (!form.lat || !form.lng) return alert("Cargá la ubicación (o usá 'mi ubicación actual').");
    setGuardando(true);
    try {
      await sbPost("locales", {
        id: `local_${Date.now()}`, nombre: form.nombre.trim(),
        lat: Number(form.lat), lng: Number(form.lng), radio_metros: Number(form.radio_metros) || 150,
      });
      setForm({ nombre: "", lat: "", lng: "", radio_metros: 150 });
      await cargar();
    } catch { alert("No se pudo crear el depósito."); }
    finally { setGuardando(false); }
  };

  const cambiarRadio = async (id, radio) => {
    setLocales((ls) => ls.map((l) => (l.id === id ? { ...l, radio_metros: radio } : l)));
    try { await sbPatch(`locales?id=eq.${id}`, { radio_metros: Number(radio) || 0 }); }
    catch { alert("No se pudo guardar el radio."); cargar(); }
  };

  const borrar = async (id, nombre) => {
    if (!confirm(`¿Borrar el depósito "${nombre}"?`)) return;
    try { await sbDelete(`locales?id=eq.${id}`); setLocales((ls) => ls.filter((l) => l.id !== id)); }
    catch { alert("No se pudo borrar."); }
  };

  if (cargando) return <p className="text-[#5c6b78] text-center py-16">Cargando…</p>;
  if (error) return <p className="text-[#e5484d] text-center py-10">{error}</p>;

  return (
    <div className="max-w-2xl">
      <div className="bg-white border border-[#e3e8ed] rounded-2xl p-5 mb-5 shadow-lg">
        <h2 className="text-base font-bold mb-1">Nuevo depósito / sucursal</h2>
        <p className="text-[#94a1ab] text-xs mb-4">Tip: parate en el lugar y tocá "Usar mi ubicación actual" para capturar las coordenadas.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Nombre</label>
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2.5 py-2 text-sm outline-none mt-1" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Latitud</label>
            <input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2.5 py-2 text-sm outline-none mt-1" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Longitud</label>
            <input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2.5 py-2 text-sm outline-none mt-1" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Radio (m)</label>
            <input value={form.radio_metros} onChange={(e) => setForm({ ...form, radio_metros: e.target.value })} type="number" className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2.5 py-2 text-sm outline-none mt-1" />
          </div>
        </div>
        <div className="flex gap-2 mt-4 flex-wrap">
          <button onClick={usarMiUbicacion} disabled={capturando} className="px-4 py-2.5 rounded-lg font-bold text-sm bg-[#2ba9e0] text-white disabled:opacity-50">
            {capturando ? "Obteniendo…" : "📍 Usar mi ubicación actual"}
          </button>
          <button onClick={crear} disabled={guardando} className="px-4 py-2.5 rounded-lg font-bold text-sm bg-[#16a34a] text-white disabled:opacity-50">
            {guardando ? "Guardando…" : "Crear depósito"}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {locales.length === 0 && <p className="text-[#94a1ab] text-sm italic">No hay depósitos cargados.</p>}
        {locales.map((l) => (
          <div key={l.id} className="bg-white border border-[#e3e8ed] rounded-xl p-3 flex items-center gap-3 flex-wrap shadow-sm">
            <div className="flex-1 min-w-[160px]">
              <p className="text-sm font-semibold">{l.nombre}</p>
              <p className="text-[11px] text-[#94a1ab] tabular-nums">{Number(l.lat).toFixed(5)}, {Number(l.lng).toFixed(5)}</p>
            </div>
            <div className="flex items-center gap-1">
              <label className="text-[11px] text-[#94a1ab]">Radio</label>
              <input defaultValue={l.radio_metros} onBlur={(e) => cambiarRadio(l.id, e.target.value)} type="number" className="w-20 bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2 py-1 text-xs outline-none" />
              <span className="text-[11px] text-[#94a1ab]">m</span>
            </div>
            <button onClick={() => borrar(l.id, l.nombre)} className="text-xs text-[#e5484d] px-2 py-1 rounded-lg border border-[#e5484d]/40">Borrar</button>
          </div>
        ))}
      </div>
    </div>
  );
}
