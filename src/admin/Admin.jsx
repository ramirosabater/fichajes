import { useState } from "react";
import { loginAdmin, logoutAdmin } from "./supabase-admin.js";
import Empleados from "./Empleados.jsx";
import Plantillas from "./Plantillas.jsx";
import Sectores from "./Sectores.jsx";
import Dashboard from "./Dashboard.jsx";
import Reportes from "./Reportes.jsx";
import Dispositivos from "./Dispositivos.jsx";
import Aprobaciones from "./Aprobaciones.jsx";
import Configuracion from "./Configuracion.jsx";
import Depositos from "./Depositos.jsx";
import Fichadas from "./Fichadas.jsx";
import Presentismo from "./Presentismo.jsx";
import { LOGO } from "../lib/logo.js";

export default function Admin() {
  const [logueado, setLogueado] = useState(false);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState(null);
  const [entrando, setEntrando] = useState(false);
  const [vista, setVista] = useState("dashboard");

  const entrar = async () => {
    setError(null);
    if (!email || !pass) return setError("Completá email y contraseña.");
    setEntrando(true);
    try {
      await loginAdmin(email.trim(), pass);
      setLogueado(true);
    } catch {
      setError("Email o contraseña incorrectos.");
    } finally {
      setEntrando(false);
    }
  };

  const salir = () => { logoutAdmin(); setLogueado(false); setPass(""); };

  if (!logueado) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4">
        <div className="w-full max-w-[380px] bg-[#ffffff] rounded-[28px] shadow-lg border border-[#e3e8ed] p-6">
          <div className="flex flex-col items-center text-center mb-6">
            <img src={LOGO} alt="ANAFER" className="h-12 mb-3" />
            <h1 className="text-lg font-bold">Panel de RR.HH.</h1>
            <p className="text-[#94a1ab] text-sm mt-1">Acceso solo para personal autorizado</p>
          </div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" autoComplete="username"
            className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-xl px-4 py-3 outline-none" />
          <input value={pass} onChange={(e) => setPass(e.target.value)} type="password" placeholder="Contraseña" autoComplete="current-password"
            onKeyDown={(e) => e.key === "Enter" && entrar()}
            className="w-full mt-3 bg-[#f1f4f7] border border-[#cfd6dd] rounded-xl px-4 py-3 outline-none" />
          {error && <p className="text-[#e5484d] text-xs mt-2">{error}</p>}
          <button onClick={entrar} disabled={entrando} className="w-full mt-4 py-3 rounded-xl font-bold bg-[#e1251b] text-white disabled:opacity-50">
            {entrando ? "Entrando…" : "Entrar"}
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "presentismo", label: "En vivo" },
    { id: "empleados", label: "Empleados" },
    { id: "plantillas", label: "Plantillas" },
    { id: "sectores", label: "Sectores" },
    { id: "depositos", label: "Depósitos" },
    { id: "fichadas", label: "Corrección" },
    { id: "reportes", label: "Reportes" },
    { id: "dispositivos", label: "Dispositivos" },
    { id: "aprobaciones", label: "Aprobaciones" },
    { id: "config", label: "Configuración" },
  ];

  return (
    <div className="min-h-screen w-full">
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex rounded-xl bg-[#ffffff] border border-[#e3e8ed] p-1">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setVista(t.id)}
                className="px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={{ backgroundColor: vista === t.id ? "#e1251b" : "transparent", color: vista === t.id ? "#ffffff" : "#5c6b78" }}>
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={salir} className="text-xs text-[#5c6b78] hover:text-[#1f2d38] py-1.5 px-3 rounded-lg border border-[#e3e8ed] bg-[#ffffff]">
            Cerrar sesión
          </button>
        </div>

        {vista === "dashboard" && <Dashboard />}
        {vista === "presentismo" && <Presentismo />}
        {vista === "empleados" && <Empleados />}
        {vista === "plantillas" && <Plantillas />}
        {vista === "sectores" && <Sectores />}
        {vista === "depositos" && <Depositos />}
        {vista === "fichadas" && <Fichadas />}
        {vista === "reportes" && <Reportes />}
        {vista === "dispositivos" && <Dispositivos />}
        {vista === "aprobaciones" && <Aprobaciones />}
        {vista === "config" && <Configuracion />}
      </div>
    </div>
  );
}
