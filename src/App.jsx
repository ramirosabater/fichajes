import { useState, useEffect } from "react";
import { sbGet, sbRpc } from "./lib/supabase.js";
import {
  calcularEstado, obtenerPosicion, localMasCercano, obtenerDeviceId,
} from "./lib/fichaje.js";
import Historial from "./screens/Historial.jsx";
import Equipo from "./screens/Equipo.jsx";

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

  // Estado del turno
  const [ahora, setAhora] = useState(new Date());
  const [enTurno, setEnTurno] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const horarioEmpleado = empleado ? horarios.find((h) => String(h.id) === String(empleado.horario_id)) : null;

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
        setEmpleado(r.empleado);
        setPinAuth(pin);
        setTardanzas(r.tardanzas_periodo || 0);
        setACargo(r.a_cargo || 0);
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
    setEnTurno(false); setHistorial([]); setMsg(null); setTardanzas(0); setACargo(0); setVista("fichaje");
  };

  const fichar = async () => {
    const tipo = enTurno ? "salida" : "entrada";
    setGuardando(true);
    setMsg(null);
    try {
      const hora = new Date();
      const pos = await obtenerPosicion();
      const ubic = localMasCercano(pos, locales);
      const est = calcularEstado(tipo, hora, horarioEmpleado);
      const r = await sbRpc("registrar_fichaje", {
        p_legajo: empleado.legajo,
        p_pin: pinAuth,
        p_data: {
          tipo,
          timestamp: hora.toISOString(),
          lat: pos?.lat ?? null,
          lng: pos?.lng ?? null,
          local_id: ubic.local ? ubic.local.id : null,
          distancia_metros: ubic.distancia ?? null,
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
        <div className="w-full max-w-[380px] bg-[#1c2128] rounded-[28px] shadow-2xl border border-[#2d3748] p-6">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-[#242b35] border border-[#2d3748] flex items-center justify-center mb-3 text-2xl">🕑</div>
            <h1 className="text-lg font-bold">Identificate para fichar</h1>
            <p className="text-[#5a6578] text-sm mt-1">Ingresá tu legajo y tu PIN</p>
          </div>
          <input value={legajo} onChange={(e) => setLegajo(e.target.value)} type="number" placeholder="Legajo"
            className="w-full bg-[#242b35] border border-[#3a4353] rounded-xl px-4 py-3 text-center text-lg outline-none" />
          <input value={pin} onChange={(e) => setPin(e.target.value)} type="password" inputMode="numeric" placeholder="PIN"
            onKeyDown={(e) => e.key === "Enter" && ingresar()}
            className="w-full mt-3 bg-[#242b35] border border-[#3a4353] rounded-xl px-4 py-3 text-center text-lg tracking-[0.5em] outline-none" />
          {errorLogin && <p className="text-[#e5484d] text-sm mt-3">{errorLogin}</p>}
          <button onClick={ingresar} disabled={buscando}
            className="w-full mt-4 py-3 rounded-xl font-bold bg-[#f2a900] text-[#12161c] disabled:opacity-50">
            {buscando ? "Ingresando…" : "Continuar"}
          </button>

          {!modoPin ? (
            <button onClick={() => { setModoPin(true); setPinMsg(null); }}
              className="w-full mt-3 text-xs text-[#5a6578] hover:text-[#8b95a5]">Cambiar mi PIN</button>
          ) : (
            <div className="mt-4 pt-4 border-t border-dashed border-[#3a4353]">
              <p className="text-[10px] uppercase tracking-widest text-[#5a6578] mb-2">Cambiar mi PIN</p>
              <p className="text-[11px] text-[#5a6578] mb-3">Usá el legajo de arriba. Necesitás tu PIN actual.</p>
              <input value={pinActual} onChange={(e) => setPinActual(e.target.value)} type="password" inputMode="numeric" placeholder="PIN actual"
                className="w-full bg-[#242b35] border border-[#3a4353] rounded-xl px-4 py-2.5 text-center tracking-[0.4em] outline-none mb-2" />
              <input value={pinNuevo} onChange={(e) => setPinNuevo(e.target.value)} type="password" inputMode="numeric" placeholder="PIN nuevo"
                className="w-full bg-[#242b35] border border-[#3a4353] rounded-xl px-4 py-2.5 text-center tracking-[0.4em] outline-none mb-2" />
              <input value={pinRep} onChange={(e) => setPinRep(e.target.value)} type="password" inputMode="numeric" placeholder="Repetir PIN nuevo"
                onKeyDown={(e) => e.key === "Enter" && cambiarMiPin()}
                className="w-full bg-[#242b35] border border-[#3a4353] rounded-xl px-4 py-2.5 text-center tracking-[0.4em] outline-none" />
              {pinMsg && <p className={`text-xs mt-2 ${pinMsg.ok ? "text-[#3ddc84]" : "text-[#e5484d]"}`}>{pinMsg.texto}</p>}
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setModoPin(false); setPinMsg(null); setPinActual(""); setPinNuevo(""); setPinRep(""); }}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-xs bg-[#242b35] border border-[#3a4353] text-[#8b95a5]">Volver</button>
                <button onClick={cambiarMiPin} disabled={cambiandoPin}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-[#f2a900] text-[#12161c] disabled:opacity-50">
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

  // ---------- Equipo ----------
  if (vista === "equipo") {
    return <Equipo empleado={empleado} pin={pinAuth} horarios={horarios} onVolver={() => setVista("fichaje")} />;
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
      <div className="w-full max-w-[400px] bg-[#1c2128] rounded-[28px] shadow-2xl border border-[#2d3748] overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-dashed border-[#3a4353]">
          <div>
            <p className="text-[#8b95a5] text-xs uppercase tracking-widest">{empleado.apellido}, {empleado.nombre}</p>
            <p className="text-sm capitalize">{ahora.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
          <button onClick={salir} className="text-[#5a6578] hover:text-[#8b95a5] text-xs">Salir</button>
        </div>

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
            style={{ backgroundColor: enTurno ? "rgba(61,220,132,.12)" : "#242b35", color: enTurno ? "#3ddc84" : "#8b95a5" }}>
            {enTurno ? `EN TURNO · ${duracion()}` : "FUERA DE TURNO"}
          </span>
          {!horarioEmpleado && <p className="text-[11px] text-[#5a6578] mt-3">Sin turno asignado</p>}
        </div>

        {msg && <p className={`mx-6 mb-3 text-xs text-center font-semibold ${msg.ok ? "text-[#3ddc84]" : "text-[#e5484d]"}`}>{msg.texto}</p>}

        <div className="px-6 pb-3">
          <button onClick={fichar} disabled={guardando}
            className="w-full py-4 rounded-xl font-bold text-base transition active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: enTurno ? "#e5484d" : "#f2a900", color: enTurno ? "#fff" : "#12161c" }}>
            {guardando ? "Registrando…" : enTurno ? "FICHAR SALIDA" : "FICHAR ENTRADA"}
          </button>
        </div>

        {aCargo > 0 && (
          <div className="px-6 pb-3">
            <button onClick={() => setVista("equipo")}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-[#242b35] border border-[#2d3748] hover:border-[#3a4353]">
              👥 Revisar mi equipo ({aCargo})
            </button>
          </div>
        )}

        <div className="px-6 pb-3">
          <button onClick={() => setVista("historial")}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-[#242b35] border border-[#2d3748] hover:border-[#3a4353]">
            📋 Mi historial
          </button>
        </div>

        <div className="px-6 pb-6">
          <p className="text-[10px] uppercase tracking-widest text-[#5a6578] mb-2">Cartilla de hoy</p>
          {historial.length === 0 ? (
            <p className="text-[#5a6578] text-sm italic">Todavía no fichaste ningún movimiento.</p>
          ) : (
            <div className="space-y-1">
              {historial.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-[#242b35] last:border-0">
                  <span className="capitalize">{r.tipo === "entrada" ? "🟢 Entrada" : "🔴 Salida"}</span>
                  <span className="text-[#8b95a5] tabular-nums">{r.hora.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
