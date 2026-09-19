import { useState, useEffect } from "react";
import { sbRpc } from "../lib/supabase.js";
import { calcularPeriodo, etiquetaPeriodo } from "../lib/fichaje.js";
import { computarCumplimiento, textoIncumplimientos, minAHoras } from "../lib/cumplimiento.js";
import { enviarEmailRRHH, textoEmail } from "../lib/email.js";

function Chip({ label, valor, color }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] rounded-md px-1.5 py-0.5"
      style={{ backgroundColor: "rgba(0,0,0,0.05)", color }}>
      <span className="opacity-70">{label}</span><b>{valor}</b>
    </span>
  );
}

export default function Equipo({ empleado, pin, horarios, config, onVolver }) {
  const [refMes, setRefMes] = useState(new Date());
  const { desde, hasta } = calcularPeriodo(refMes);
  const [equipo, setEquipo] = useState([]);
  const [verif, setVerif] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [expandido, setExpandido] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [modoObservar, setModoObservar] = useState(false);
  const [motivo, setMotivo] = useState("");

  const cargar = async () => {
    setCargando(true); setError(null); setResultado(null); setModoObservar(false); setMotivo("");
    try {
      const r = await sbRpc("fichadas_equipo", {
        p_legajo: empleado.legajo, p_pin: pin,
        p_desde: desde.toISOString(), p_hasta: hasta.toISOString(),
      });
      if (!r || !r.ok) setError("No se pudo cargar el equipo.");
      else { setEquipo(Array.isArray(r.equipo) ? r.equipo : []); setVerif(r.verificacion || null); }
    } catch {
      setError("No se pudo conectar con la base.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [refMes]);

  const cambiarMes = (delta) => setRefMes((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));

  const equipoCumpl = equipo.map((m) => ({
    ...m,
    cumpl: computarCumplimiento(m.fichajes || [], (horarios || []).find((h) => String(h.id) === String(m.horario_id)) || null, desde, hasta, config),
  }));

  const aprobar = async () => {
    setEnviando(true);
    try {
      const r = await sbRpc("verificar_periodo", {
        p_legajo: empleado.legajo, p_pin: pin,
        p_desde: desde.toISOString(), p_hasta: hasta.toISOString(),
      });
      if (!r || !r.ok) { setResultado({ ok: false, texto: "No se pudo registrar la aprobación." }); return; }
      const v = r.verificacion || {};
      const email = await enviarEmailRRHH({
        tipo: "APROBADO", responsable: `${empleado.apellido}, ${empleado.nombre}`,
        sector: v.sectores || "-", periodo: etiquetaPeriodo(desde, hasta),
        cantidad: String(v.cantidad ?? equipo.length), motivo: "", fecha: new Date().toLocaleString("es-AR"),
      });
      setVerif({ estado: "aprobado" });
      setResultado({ ok: true, texto: textoEmail(email, "Período aprobado.") });
    } catch {
      setResultado({ ok: false, texto: "Error al aprobar. Probá de nuevo." });
    } finally {
      setEnviando(false);
    }
  };

  const observar = async () => {
    if (!motivo.trim()) { setResultado({ ok: false, texto: "Escribí el motivo de la observación." }); return; }
    setEnviando(true);
    try {
      const r = await sbRpc("observar_periodo", {
        p_legajo: empleado.legajo, p_pin: pin,
        p_desde: desde.toISOString(), p_hasta: hasta.toISOString(), p_motivo: motivo.trim(),
      });
      if (!r || !r.ok) { setResultado({ ok: false, texto: "No se pudo registrar la observación." }); return; }
      const v = r.verificacion || {};
      const email = await enviarEmailRRHH({
        tipo: "OBSERVADO / NO APROBADO", responsable: `${empleado.apellido}, ${empleado.nombre}`,
        sector: v.sectores || "-", periodo: etiquetaPeriodo(desde, hasta),
        cantidad: String(v.cantidad ?? equipo.length), motivo: motivo.trim(), fecha: new Date().toLocaleString("es-AR"),
      });
      setVerif({ estado: "observado", motivo: motivo.trim() });
      setModoObservar(false);
      setResultado({ ok: true, texto: textoEmail(email, "Observación enviada al admin para revisión.") });
    } catch {
      setResultado({ ok: false, texto: "Error al enviar la observación." });
    } finally {
      setEnviando(false);
    }
  };

  const totalMov = equipo.reduce((n, m) => n + (m.fichajes ? m.fichajes.length : 0), 0);
  const bloqueado = !!verif;

  return (
    <div className="min-h-screen w-full flex items-start justify-center p-4">
      <div className="w-full max-w-[420px] bg-[#ffffff] rounded-[28px] shadow-lg border border-[#e3e8ed] overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-dashed border-[#cfd6dd]">
          <div>
            <p className="text-sm font-bold">👥 Mi equipo</p>
            <p className="text-[#94a1ab] text-xs">{empleado.apellido}, {empleado.nombre}</p>
          </div>
          <button onClick={onVolver} className="text-[#94a1ab] hover:text-[#5c6b78] text-xl leading-none">×</button>
        </div>

        <div className="mx-6 mt-4 mb-3 rounded-xl bg-[#f1f4f7] border border-[#e3e8ed] p-3 flex items-center justify-between">
          <button onClick={() => cambiarMes(-1)} className="text-[#5c6b78] hover:text-[#1f2d38] px-2 text-lg">‹</button>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest text-[#94a1ab]">Período</p>
            <p className="text-sm font-semibold">{etiquetaPeriodo(desde, hasta)}</p>
          </div>
          <button onClick={() => cambiarMes(1)} className="text-[#5c6b78] hover:text-[#1f2d38] px-2 text-lg">›</button>
        </div>

        {verif && !resultado && (
          <div className="mx-6 mb-3 rounded-xl p-3 flex items-start gap-2 border" style={{
            backgroundColor: verif.estado === "observado" ? "rgba(225,37,27,.1)" : "rgba(61,220,132,.1)",
            borderColor: verif.estado === "observado" ? "rgba(225,37,27,.4)" : "rgba(61,220,132,.3)",
          }}>
            <span>{verif.estado === "observado" ? "⚠️" : "✓"}</span>
            <div className="text-xs">
              {verif.estado === "observado" ? (
                <>
                  <span className="text-[#e1251b] font-semibold">Observado — enviado al admin.</span>
                  {verif.motivo && <p className="text-[#5c6b78] mt-1">Motivo: {verif.motivo}</p>}
                </>
              ) : verif.estado === "admin_rechazado" ? (
                <span className="text-[#e5484d] font-semibold">Rechazado por el admin.{verif.resolucion ? ` ${verif.resolucion}` : ""}</span>
              ) : (
                <span className="text-[#16a34a] font-semibold">Este período ya fue aprobado.</span>
              )}
            </div>
          </div>
        )}

        <div className="px-6 pb-4">
          {cargando ? (
            <p className="text-[#5c6b78] text-sm text-center py-10">Cargando equipo…</p>
          ) : error ? (
            <p className="text-[#e5484d] text-sm text-center py-8">{error}</p>
          ) : equipo.length === 0 ? (
            <p className="text-[#94a1ab] text-sm text-center py-8 italic">No tenés personas a cargo.</p>
          ) : (
            <>
              <p className="text-[10px] uppercase tracking-widest text-[#94a1ab] mb-2">
                {equipo.length} persona{equipo.length !== 1 ? "s" : ""} · {totalMov} fichada{totalMov !== 1 ? "s" : ""}
              </p>
              <div className="space-y-2">
                {equipoCumpl.map((m) => {
                  const abierto = expandido === m.legajo;
                  const c = m.cumpl;
                  const alerta = c.sinRegistro > 0 || c.sinEntrada > 0 || c.sinSalida > 0 || c.descuentoMin > 0;
                  return (
                    <div key={m.legajo} className="rounded-xl bg-[#f1f4f7] border border-[#e3e8ed] overflow-hidden">
                      <button onClick={() => setExpandido(abierto ? null : m.legajo)} className="w-full px-3 py-2.5 flex items-center justify-between text-left">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{m.apellido}, {m.nombre}</p>
                          <p className="text-[11px] text-[#94a1ab]">{m.sector || "Sin sector"}</p>
                        </div>
                        <span className="text-[#94a1ab] text-xs">{abierto ? "▲" : "▼"}</span>
                      </button>
                      <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                        {c.sinTurno ? (
                          <span className="text-[10px] text-[#94a1ab] italic">Sin turno asignado</span>
                        ) : (
                          <>
                            <Chip label="Trab." valor={c.diasTrabajados} color="#16a34a" />
                            {c.sinRegistro > 0 && <Chip label="Sin registro" valor={c.sinRegistro} color="#e5484d" />}
                            {c.sinEntrada > 0 && <Chip label="Sin entrada" valor={c.sinEntrada} color="#e5484d" />}
                            {c.sinSalida > 0 && <Chip label="Sin salida" valor={c.sinSalida} color="#e1251b" />}
                          </>
                        )}
                        {c.descuentoMin > 0 && <Chip label="Descuento" valor={`${c.descuentoMin}m`} color="#e5484d" />}
                        {c.horas50Min > 0 && <Chip label="50%" valor={minAHoras(c.horas50Min)} color="#2ba9e0" />}
                        {c.horas100Min > 0 && <Chip label="100%" valor={minAHoras(c.horas100Min)} color="#e5484d" />}
                        {!alerta && !c.sinTurno && <Chip label="OK" valor="✓" color="#16a34a" />}
                      </div>
                      {abierto && (
                        <div className="px-3 pb-2.5 border-t border-[#e3e8ed]">
                          {(m.fichajes || []).length === 0 ? (
                            <p className="text-[11px] text-[#94a1ab] italic py-2">Sin fichadas en el período.</p>
                          ) : (
                            m.fichajes.map((f, i) => (
                              <div key={i} className="flex items-center justify-between py-1.5 text-xs">
                                <span>{f.tipo === "entrada" ? "🟢 Entrada" : "🔴 Salida"}</span>
                                <span className="text-[#5c6b78] tabular-nums">
                                  {new Date(f.timestamp).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {resultado && (
          <p className={`mx-6 mb-3 text-xs text-center font-semibold ${resultado.ok ? "text-[#16a34a]" : "text-[#e5484d]"}`}>{resultado.texto}</p>
        )}

        {!cargando && !error && equipo.length > 0 && !bloqueado && (
          <div className="px-6 pb-6">
            {!modoObservar ? (
              <div className="space-y-2">
                <button onClick={aprobar} disabled={enviando}
                  className="w-full py-4 rounded-xl font-bold text-base transition active:scale-[0.98] disabled:opacity-40"
                  style={{ backgroundColor: "#16a34a", color: "#ffffff" }}>
                  {enviando ? "ENVIANDO…" : "✓ APROBAR Y AVISAR A RR.HH."}
                </button>
                <button onClick={() => { setModoObservar(true); setResultado(null); if (!motivo) setMotivo(textoIncumplimientos(equipoCumpl, desde, hasta)); }}
                  disabled={enviando}
                  className="w-full py-3 rounded-xl font-semibold text-sm bg-[#f1f4f7] border border-[#cfd6dd] text-[#e1251b] disabled:opacity-40">
                  ⚠️ No aprobar (marcar observación)
                </button>
              </div>
            ) : (
              <div className="rounded-xl bg-[#f1f4f7] border border-[#cfd6dd] p-3">
                <p className="text-[10px] uppercase tracking-widest text-[#94a1ab] mb-2">Motivo de la observación</p>
                <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={4}
                  className="w-full bg-[#ffffff] border border-[#cfd6dd] rounded-lg px-3 py-2 text-sm outline-none resize-none" />
                <div className="flex gap-2 mt-3">
                  <button onClick={() => { setModoObservar(false); }} disabled={enviando}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-xs bg-[#ffffff] border border-[#cfd6dd] text-[#5c6b78] disabled:opacity-40">Volver</button>
                  <button onClick={observar} disabled={enviando}
                    className="flex-[2] py-2.5 rounded-xl font-bold text-xs disabled:opacity-40" style={{ backgroundColor: "#e1251b", color: "#ffffff" }}>
                    {enviando ? "…" : "Enviar observación al admin"}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
