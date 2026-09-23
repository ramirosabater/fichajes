import { useState, useEffect } from "react";
import { sbGet, sbRpc } from "./lib/supabase.js";
import {
  calcularEstado, obtenerPosicion, estadoUbicacion, obtenerDeviceId, bloqueDeHoy,
} from "./lib/fichaje.js";
import Historial from "./screens/Historial.jsx";
import Equipo from "./screens/Equipo.jsx";
import Ausencias from "./screens/Ausencias.jsx";
import { LOGO } from "./lib/logo.js";
import { cargarConfig } from "./lib/cumplimiento.js";

export default function App() {
  // Identificación
  const [legajo, setLegajo] = useState("");
  const [pin, setPin] = useState("");
  const [pinAuth, setPinAuth] = useState(null);
  const [empleado, setEmpleado] = useState(null);
  const [errorLogin, setErrorLogin] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [tardanzas, setTardanzas] = useState(0);
  const [aCargo, setACargo] = useState(0);
  const [ausenciasPend, setAusenciasPend] = useState(0);
  const [vista, setVista] = useState("fichaje"); // "fichaje" | "historial" | "equipo"

  // Cambio de PIN (desde el login)
  const [modoPin, setModoPin] = useState(false);
  const [pinActual, setPinActual] = useState("");
  const [pinNuevo, setPinNuevo] = useState("");
  const [pinRep, setPinRep] = useState("");
  const [pinMsg, setPinMsg] = useState(null);
  const [cambiandoPin, setCambiandoPin] = useState(false);

  // Datos base
  const [horarios, setHorarios] = useState([]);
  const [locales, setLocales] = useState([]);
  const [config, setConfig] = useState({ recargos: [], feriados: {} });

  // Estado del turno
  const [ahora, setAhora] = useState(new Date());
  const [enTurno, setEnTurno] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState(null);
  const [ubic, setUbic] = useState(null); // { tipo, local, distancia }
  const [ubicCargando, setUbicCargando] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const horarioEmpleado = empleado ? horarios.find((h) => String(h.id) === String(empleado.horario_id)) : null;

  const refrescarUbicacion = async () => {
    setUbicCargando(true);
    try {
      const pos = await obtenerPosicion();
      setUbic(estadoUbicacion(pos, locales));
    } catch { setUbic({ tipo: "sin_gps" }); }
    finally { setUbicCargando(false); }
  };

  // Al entrar al fichaje, obtener la ubicación para mostrarla
  useEffect(() => {
    if (empleado && vista === "fichaje") refrescarUbicacion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empleado, vista, locales]);

  const ingresar = async () => {
    setErrorLogin(null);
    const nro = parseInt(legajo, 10);
    if (!nro) return setErrorLogin("Ingresá un número de legajo válido.");
    if (!pin || pin.length < 4) return setErrorLogin("Ingresá tu PIN (mínimo 4 dígitos).");
    setBuscando(true);
    try {
      const r = await sbRpc("login_empleado", { p_legajo: nro, p_pin: pin });
      if (!r || !r.ok) {
        setErrorLogin(r?.motivo === "pin_incorrecto" ? "PIN incorrecto." : "No se encontró ningún empleado con ese legajo.");
      } else {
        const [hs, ls] = await Promise.all([sbGet("horarios?select=*"), sbGet("locales?select=*")]);
        setHorarios(hs);
        setLocales(ls);
        // La config de recargos es opcional: si falla, se usan los valores por defecto y el login igual funciona.
        try { setConfig(await cargarConfig(sbGet)); } catch { /* usa defaults */ }
        setEmpleado(r.empleado);
        setPinAuth(pin);
        setTardanzas(r.tardanzas_periodo || 0);
        setACargo(r.a_cargo || 0);
        setAusenciasPend(r.ausencias_pendientes || 0);
        setVista("fichaje");
        const hoy = Array.isArray(r.fichajes_hoy) ? r.fichajes_hoy : [];
        if (hoy.length) {
          const ultimo = hoy[hoy.length - 1];
          setEnTurno(ultimo.tipo === "entrada");
          setHistorial(hoy.slice().reverse().map((f) => ({ tipo: f.tipo, hora: new Date(f.timestamp), estado: f.estado })));
        }
      }
    } catch {
      setErrorLogin("No se pudo conectar con la base. Revisá la conexión.");
    } finally {
      setBuscando(false);
    }
  };

  const cambiarMiPin = async () => {
    setPinMsg(null);
    const nro = parseInt(legajo, 10);
    if (!nro) return setPinMsg({ ok: false, texto: "Ingresá tu legajo arriba." });
    if (!pinActual) return setPinMsg({ ok: false, texto: "Ingresá tu PIN actual." });
    if (!pinNuevo || pinNuevo.length < 4) return setPinMsg({ ok: false, texto: "El PIN nuevo debe tener 4+ dígitos." });
    if (pinNuevo !== pinRep) return setPinMsg({ ok: false, texto: "El PIN nuevo no coincide." });
    setCambiandoPin(true);
    try {
      const r = await sbRpc("cambiar_pin", { p_legajo: nro, p_pin_actual: pinActual, p_nuevo_pin: pinNuevo });
      if (!r || !r.ok) {
        setPinMsg({ ok: false, texto: r?.motivo === "pin_incorrecto" ? "El PIN actual es incorrecto." : "No se encontró ese legajo." });
      } else {
        setPinMsg({ ok: true, texto: "¡PIN actualizado! Ya podés ingresar con el nuevo." });
        setPinActual(""); setPinNuevo(""); setPinRep("");
      }
    } catch {
      setPinMsg({ ok: false, texto: "No se pudo conectar. Probá de nuevo." });
    } finally {
      setCambiandoPin(false);
    }
  };

  const salir = () => {
    setEmpleado(null); setPinAuth(null); setLegajo(""); setPin("");
    setEnTurno(false); setHistorial([]); setMsg(null); setTardanzas(0); setACargo(0); setAusenciasPend(0); setVista("fichaje");
  };

  const fichar = async () => {
    const tipo = enTurno ? "salida" : "entrada";
    setGuardando(true);
    setMsg(null);
    try {
      const hora = new Date();
      const pos = await obtenerPosicion();
      const eu = estadoUbicacion(pos, locales);
      setUbic(eu);
      const dentro = eu.tipo === "dentro";
      const est = calcularEstado(tipo, hora, horarioEmpleado);
      const r = await sbRpc("registrar_fichaje", {
        p_legajo: empleado.legajo,
        p_pin: pinAuth,
        p_data: {
          tipo,
          timestamp: hora.toISOString(),
          lat: pos?.lat ?? null,
          lng: pos?.lng ?? null,
          local_id: dentro ? eu.local.id : null,
          distancia_metros: eu.distancia ?? null,
          estado: est.estado,
          minutos_tarde: est.minutosTarde || 0,
          device_id: obtenerDeviceId(),
          user_agent: navigator.userAgent.slice(0, 300),
        },
      });
      if (!r || !r.ok) throw new Error("rechazado");
      setHistorial((h) => [{ tipo, hora, estado: est.estado }, ...h]);
      if (est.estado === "tarde") setTardanzas((n) => n + 1);
      setEnTurno(!enTurno);
      setMsg({ ok: true, texto: `${tipo === "entrada" ? "Entrada" : "Salida"} registrada · ${est.label}` });
    } catch {
      setMsg({ ok: false, texto: "No se pudo guardar el fichaje. Probá de nuevo." });
    } finally {
      setGuardando(false);
    }
  };

  // ---------- Login ----------
  if (!empleado) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4">
        <div className="w-full max-w-[380px] bg-[#ffffff] rounded-[28px] shadow-lg border border-[#e3e8ed] p-6">
          <div className="flex flex-col items-center text-center mb-6">
            <img src={LOGO} alt="ANAFER" className="h-12 mb-3" />
            <h1 className="text-lg font-bold">Identificate para fichar</h1>
            <p className="text-[#94a1ab] text-sm mt-1">Ingresá tu legajo y tu PIN</p>
          </div>
          <input value={legajo} onChange={(e) => setLegajo(e.target.value)} type="number" placeholder="Legajo"
            className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-xl px-4 py-3 text-center text-lg outline-none" />
          <input value={pin} onChange={(e) => setPin(e.target.value)} type="password" inputMode="numeric" placeholder="PIN"
            onKeyDown={(e) => e.key === "Enter" && ingresar()}
            className="w-full mt-3 bg-[#f1f4f7] border border-[#cfd6dd] rounded-xl px-4 py-3 text-center text-lg tracking-[0.5em] outline-none" />
          {errorLogin && <p className="text-[#e5484d] text-sm mt-3">{errorLogin}</p>}
          <button onClick={ingresar} disabled={buscando}
            className="w-full mt-4 py-3 rounded-xl font-bold bg-[#e1251b] text-white disabled:opacity-50">
            {buscando ? "Ingresando…" : "Continuar"}
          </button>

          {!modoPin ? (
            <button onClick={() => { setModoPin(true); setPinMsg(null); }}
              className="w-full mt-3 text-xs text-[#94a1ab] hover:text-[#5c6b78]">Cambiar mi PIN</button>
          ) : (
            <div className="mt-4 pt-4 border-t border-dashed border-[#cfd6dd]">
              <p className="text-[10px] uppercase tracking-widest text-[#94a1ab] mb-2">Cambiar mi PIN</p>
              <p className="text-[11px] text-[#94a1ab] mb-3">Usá el legajo de arriba. Necesitás tu PIN actual.</p>
              <input value={pinActual} onChange={(e) => setPinActual(e.target.value)} type="password" inputMode="numeric" placeholder="PIN actual"
                className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-xl px-4 py-2.5 text-center tracking-[0.4em] outline-none mb-2" />
              <input value={pinNuevo} onChange={(e) => setPinNuevo(e.target.value)} type="password" inputMode="numeric" placeholder="PIN nuevo"
                className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-xl px-4 py-2.5 text-center tracking-[0.4em] outline-none mb-2" />
              <input value={pinRep} onChange={(e) => setPinRep(e.target.value)} type="password" inputMode="numeric" placeholder="Repetir PIN nuevo"
                onKeyDown={(e) => e.key === "Enter" && cambiarMiPin()}
                className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-xl px-4 py-2.5 text-center tracking-[0.4em] outline-none" />
              {pinMsg && <p className={`text-xs mt-2 ${pinMsg.ok ? "text-[#16a34a]" : "text-[#e5484d]"}`}>{pinMsg.texto}</p>}
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setModoPin(false); setPinMsg(null); setPinActual(""); setPinNuevo(""); setPinRep(""); }}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-xs bg-[#f1f4f7] border border-[#cfd6dd] text-[#5c6b78]">Volver</button>
                <button onClick={cambiarMiPin} disabled={cambiandoPin}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-[#e1251b] text-white disabled:opacity-50">
                  {cambiandoPin ? "…" : "Guardar PIN"}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------- Historial ----------
  if (vista === "historial") {
    return <Historial empleado={empleado} pin={pinAuth} onVolver={() => setVista("fichaje")} />;
  }

  if (vista === "ausencias") {
    return <Ausencias empleado={empleado} pin={pinAuth} esJefe={aCargo > 0} onVolver={() => setVista("fichaje")} />;
  }

  // ---------- Equipo ----------
  if (vista === "equipo") {
    return <Equipo empleado={empleado} pin={pinAuth} horarios={horarios} config={config} onVolver={() => setVista("fichaje")} />;
  }

  // ---------- Fichaje ----------
  const duracion = () => {
    if (!enTurno || !historial.length) return "0h 0m";
    const ent = historial.find((h) => h.tipo === "entrada");
    if (!ent) return "0h 0m";
    const ms = ahora - ent.hora;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] bg-[#ffffff] rounded-[28px] shadow-lg border border-[#e3e8ed] overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-dashed border-[#cfd6dd]">
          <div>
            <p className="text-[#5c6b78] text-xs uppercase tracking-widest">{empleado.apellido}, {empleado.nombre}</p>
            <p className="text-sm capitalize">{ahora.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
          <button onClick={salir} className="text-[#94a1ab] hover:text-[#5c6b78] text-xs">Salir</button>
        </div>

        {aCargo > 0 && ausenciasPend > 0 && (
          <button onClick={() => setVista("ausencias")} className="mx-6 mt-3 w-[calc(100%-3rem)] rounded-xl p-3 flex items-center gap-2 border text-left"
            style={{ backgroundColor: "rgba(242,169,0,.12)", borderColor: "rgba(242,169,0,.5)" }}>
            <span>🔔</span>
            <span className="text-xs flex-1" style={{ color: "#b9820b" }}>Tenés <b>{ausenciasPend} solicitud{ausenciasPend !== 1 ? "es" : ""} de ausencia</b> de tu equipo esperando aprobación.</span>
            <span className="text-xs font-bold" style={{ color: "#e1251b" }}>Revisar ›</span>
          </button>
        )}

        {tardanzas >= 3 && (
          <div className="mx-6 mt-3 rounded-xl p-3 flex items-center gap-2 border"
            style={{ backgroundColor: "rgba(229,72,77,.1)", borderColor: "rgba(229,72,77,.4)" }}>
            <span>⚠️</span>
            <span className="text-xs text-[#e5484d]">Llevás <b>{tardanzas} llegadas tarde</b> este período. Tené en cuenta la puntualidad.</span>
          </div>
        )}

        <div className="px-6 py-6 text-center">
          <p className="text-5xl font-black tabular-nums">{ahora.toLocaleTimeString("es-AR")}</p>
          <span className="inline-block mt-3 text-xs font-semibold px-3 py-1 rounded-full"
            style={{ backgroundColor: enTurno ? "rgba(61,220,132,.12)" : "#f1f4f7", color: enTurno ? "#16a34a" : "#5c6b78" }}>
            {enTurno ? `EN TURNO · ${duracion()}` : "FUERA DE TURNO"}
          </span>
          {!horarioEmpleado && <p className="text-[11px] text-[#94a1ab] mt-3">Sin turno asignado</p>}
          {horarioEmpleado && (() => {
            // Con turno partido puede haber más de un tramo hoy; se muestra el que
            // corresponde a la próxima marcación (entrada o salida), para confirmar
            // contra qué horario se está comparando.
            const tramo = bloqueDeHoy(horarioEmpleado, ahora, enTurno ? "salida" : "entrada");
            return tramo ? <p className="text-[11px] text-[#94a1ab] mt-3">Tramo {tramo.inicio}–{tramo.fin}</p> : null;
          })()}
        </div>

        {msg && <p className={`mx-6 mb-3 text-xs text-center font-semibold ${msg.ok ? "text-[#16a34a]" : "text-[#e5484d]"}`}>{msg.texto}</p>}

        {/* Estado de ubicación */}
        <div className="px-6 pb-3">
          {(() => {
            const cfg = {
              sin_gps: { bg: "rgba(148,161,171,.12)", bd: "#cfd6dd", col: "#5c6b78", ico: "📍", txt: "Ubicación no disponible (revisá el permiso del navegador)" },
              remoto: { bg: "rgba(43,169,224,.1)", bd: "rgba(43,169,224,.4)", col: "#2ba9e0", ico: "📡", txt: "Ubicación remota — sin depósitos cargados cerca" },
              fuera: { bg: "rgba(229,72,77,.1)", bd: "rgba(229,72,77,.4)", col: "#e5484d", ico: "⚠️", txt: ubic ? `Fuera del radio de ${ubic.local?.nombre} (a ${ubic.distancia} m)` : "" },
              dentro: { bg: "rgba(22,163,74,.1)", bd: "rgba(22,163,74,.4)", col: "#16a34a", ico: "✅", txt: ubic ? `En ${ubic.local?.nombre} (a ${ubic.distancia} m)` : "" },
            };
            const c = ubicCargando || !ubic ? { bg: "#f1f4f7", bd: "#e3e8ed", col: "#5c6b78", ico: "📍", txt: "Obteniendo ubicación…" } : (cfg[ubic.tipo] || cfg.remoto);
            return (
              <div className="rounded-xl p-3 flex items-center gap-2 border" style={{ backgroundColor: c.bg, borderColor: c.bd }}>
                <span>{c.ico}</span>
                <span className="text-xs flex-1" style={{ color: c.col }}>{c.txt}</span>
                {!ubicCargando && <button onClick={refrescarUbicacion} className="text-[11px] text-[#5c6b78] hover:text-[#1f2d38]" title="Actualizar">↻</button>}
              </div>
            );
          })()}
        </div>

        <div className="px-6 pb-3">
          <button onClick={fichar} disabled={guardando}
            className="w-full py-4 rounded-xl font-bold text-base transition active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: enTurno ? "#e5484d" : "#e1251b", color: enTurno ? "#fff" : "#ffffff" }}>
            {guardando ? "Registrando…" : enTurno ? "FICHAR SALIDA" : "FICHAR ENTRADA"}
          </button>
        </div>

        {aCargo > 0 && (
          <div className="px-6 pb-3">
            <button onClick={() => setVista("equipo")}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-[#f1f4f7] border border-[#e3e8ed] hover:border-[#cfd6dd]">
              👥 Revisar mi equipo ({aCargo})
            </button>
          </div>
        )}

        <div className="px-6 pb-3">
          <button onClick={() => setVista("historial")}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-[#f1f4f7] border border-[#e3e8ed] hover:border-[#cfd6dd]">
            📋 Mi historial
          </button>
        </div>

        <div className="px-6 pb-3">
          <button onClick={() => setVista("ausencias")}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-[#f1f4f7] border border-[#e3e8ed] hover:border-[#cfd6dd]">
            📅 Ausencias / días libres
          </button>
        </div>

        <div className="px-6 pb-6">
          <p className="text-[10px] uppercase tracking-widest text-[#94a1ab] mb-2">Cartilla de hoy</p>
          {historial.length === 0 ? (
            <p className="text-[#94a1ab] text-sm italic">Todavía no fichaste ningún movimiento.</p>
          ) : (
            <div className="space-y-1">
              {historial.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-[#f1f4f7] last:border-0">
                  <span className="capitalize">{r.tipo === "entrada" ? "🟢 Entrada" : "🔴 Salida"}</span>
                  <span className="text-[#5c6b78] tabular-nums">{r.hora.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
