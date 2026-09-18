// Config de EmailJS — completá con tus datos de https://www.emailjs.com
// Mientras diga "TU_...", la app funciona igual pero no manda el aviso a RR.HH.
export const EMAILJS = {
  publicKey: "TU_PUBLIC_KEY",
  serviceId: "TU_SERVICE_ID",
  templateId: "TU_TEMPLATE_ID",
  emailRRHH: "rrhh@sagosa.com.ar",
};

export async function enviarEmailRRHH(params) {
  const cfg = EMAILJS;
  if (!cfg.serviceId || !cfg.templateId || !cfg.publicKey || String(cfg.serviceId).startsWith("TU_")) {
    return { ok: false, motivo: "sin_config" };
  }
  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: cfg.serviceId,
        template_id: cfg.templateId,
        user_id: cfg.publicKey,
        template_params: { ...params, email_rrhh: cfg.emailRRHH || "" },
      }),
    });
    return { ok: res.ok, motivo: res.ok ? null : "envio_fallido" };
  } catch {
    return { ok: false, motivo: "envio_fallido" };
  }
}

export function textoEmail(email, base) {
  if (email.ok) return `${base} Se avisó a RR.HH. ✓`;
  if (email.motivo === "sin_config") return `${base} (Falta configurar EmailJS.)`;
  return `${base} El email no salió — avisá a RR.HH. manualmente.`;
}
