import { useState } from "react";
import { loginAdmin, logoutAdmin } from "./supabase-admin.js";
import Empleados from "./Empleados.jsx";

export default function Admin() {
  const [logueado, setLogueado] = useState(false);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState(null);
  const [entrando, setEntrando] = useState(false);
  const [vista, setVista] = useState("empleados");

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
        <div className="w-full max-w-[380px] bg-[#1c2128] rounded-[28px] shadow-2xl border border-[#2d3748] p-6">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-[#242b35] border border-[#2d3748] flex items-center justify-center mb-3 text-2xl">👥</div>
            <h1 className="text-lg font-bold">Panel de RR.HH.</h1>
            <p className="text-[#5a6578] text-sm mt-1">Acceso solo para personal autorizado</p>
          </div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" autoComplete="username"
            className="w-full bg-[#242b35] border border-[#3a4353] rounded-xl px-4 py-3 outline-none" />
          <input value={pass} onChange={(e) => setPass(e.target.value)} type="password" placeholder="Contraseña" autoComplete="current-password"
            onKeyDown={(e) => e.key === "Enter" && entrar()}
            className="w-full mt-3 bg-[#242b35] border border-[#3a4353] rounded-xl px-4 py-3 outline-none" />
          {error && <p className="text-[#e5484d] text-xs mt-2">{error}</p>}
          <button onClick={entrar} disabled={entrando} className="w-full mt-4 py-3 rounded-xl font-bold bg-[#f2a900] text-[#12161c] disabled:opacity-50">
            {entrando ? "Entrando…" : "Entrar"}
          </button>
        </div>
      </div>
    );
  }

  const tabs = [{ id: "empleados", label: "Empleados" }];

  return (
    <div className="min-h-screen w-full">
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex rounded-xl bg-[#1c2128] border border-[#2d3748] p-1">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setVista(t.id)}
                className="px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                style={{ backgroundColor: vista === t.id ? "#f2a900" : "transparent", color: vista === t.id ? "#12161c" : "#8b95a5" }}>
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={salir} className="text-xs text-[#8b95a5] hover:text-[#f5f6f7] py-1.5 px-3 rounded-lg border border-[#2d3748] bg-[#1c2128]">
            Cerrar sesión
          </button>
        </div>

        {vista === "empleados" && <Empleados />}
      </div>
    </div>
  );
}
