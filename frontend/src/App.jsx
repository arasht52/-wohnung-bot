import { useState } from "react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:3001";

const STEPS = ["profile", "housing", "result"];

const EMPTY_FORM = {
  firstName: "", lastName: "", job: "", income: "",
  familySize: "1", hasPets: false,
  city: "", maxRent: "", rooms: "2",
  moveDate: "", extraNote: "",
};

const CITIES = [
  "Hamburg","Berlin","München","Frankfurt","Köln",
  "Stuttgart","Düsseldorf","Leipzig","Bremen","Hannover",
  "Nürnberg","Dresden","Karlsruhe","Mannheim","Augsburg",
];

// ── Validation ────────────────────────────────────────────────
function validateStep0(f) {
  const errs = {};
  if (!f.firstName.trim()) errs.firstName = "نام الزامی است";
  if (!f.lastName.trim())  errs.lastName  = "نام خانوادگی الزامی است";
  if (!f.job.trim())       errs.job       = "شغل الزامی است";
  const inc = parseInt(f.income);
  if (!f.income || isNaN(inc) || inc < 100 || inc > 99999)
    errs.income = "درآمد باید بین ۱۰۰ تا ۹۹۹۹۹ باشد";
  return errs;
}

function validateStep1(f) {
  const errs = {};
  if (!f.city)    errs.city    = "شهر را انتخاب کنید";
  const rent = parseInt(f.maxRent);
  if (!f.maxRent || isNaN(rent) || rent < 100 || rent > 99999)
    errs.maxRent = "مبلغ اجاره باید بین ۱۰۰ تا ۹۹۹۹۹ باشد";
  if (!f.moveDate) errs.moveDate = "تاریخ نقل مکان الزامی است";
  return errs;
}

// ── UI Primitives ─────────────────────────────────────────────
function StepIndicator({ current }) {
  const labels = ["پروفایل", "مشخصات خانه", "نتیجه"];
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:0, marginBottom:32 }}>
      {labels.map((label, i) => {
        const active = i === current, done = i < current;
        return (
          <div key={i} style={{ display:"flex", alignItems:"center" }}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
              <div style={{
                width:36, height:36, borderRadius:"50%",
                background: done ? "#C8A97E" : active ? "#1A1A2E" : "#e8e4dd",
                color: done || active ? "#fff" : "#999",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontWeight:700, fontSize:15,
                border: active ? "2px solid #C8A97E" : "2px solid transparent",
                transition:"all 0.3s",
              }}>{done ? "✓" : i+1}</div>
              <span style={{
                fontSize:11, color: active ? "#1A1A2E" : "#999",
                fontWeight: active ? 700 : 400, fontFamily:"Vazirmatn,sans-serif",
              }}>{label}</span>
            </div>
            {i < labels.length-1 && (
              <div style={{
                width:60, height:2, background: done ? "#C8A97E" : "#e8e4dd",
                marginBottom:20, transition:"background 0.3s",
              }}/>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, hint, error, children }) {
  return (
    <div style={{ marginBottom: error ? 12 : 20 }}>
      <label style={{
        display:"block", marginBottom:6, fontSize:13,
        fontWeight:600, color:"#1A1A2E", fontFamily:"Vazirmatn,sans-serif", direction:"rtl",
      }}>{label}</label>
      {hint && <p style={{ margin:"0 0 6px", fontSize:11, color:"#888", fontFamily:"Vazirmatn,sans-serif", direction:"rtl" }}>{hint}</p>}
      {children}
      {error && <p style={{ margin:"4px 0 0", fontSize:11, color:"#dc2626", fontFamily:"Vazirmatn,sans-serif", direction:"rtl" }}>⚠️ {error}</p>}
    </div>
  );
}

const inputStyle = {
  width:"100%", padding:"10px 14px", borderRadius:10,
  border:"1.5px solid #e0dbd4", fontSize:14,
  fontFamily:"Vazirmatn,sans-serif", direction:"rtl",
  background:"#faf9f7", color:"#1A1A2E",
  outline:"none", boxSizing:"border-box", transition:"border-color 0.2s",
};
const inputErr = { ...inputStyle, borderColor:"#fca5a5", background:"#fff8f8" };

// ── Main Component ────────────────────────────────────────────
export default function WohnungBot() {
  const [step,      setStep]      = useState(0);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [errors,    setErrors]    = useState({});
  const [loading,   setLoading]   = useState(false);
  const [loadingPdf,setLoadingPdf]= useState(false);
  const [result,    setResult]    = useState("");
  const [apiError,  setApiError]  = useState("");
  const [copied,    setCopied]    = useState(false);

  const upd = (k, v) => { setForm(f => ({...f, [k]:v})); setErrors(e => ({...e, [k]:undefined})); };

  // Step 0 → 1
  const goStep1 = () => {
    const errs = validateStep0(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({}); setStep(1);
  };

  // Step 1 → generate
  const generate = async () => {
    const errs = validateStep1(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({}); setLoading(true); setApiError("");

    try {
      const res = await fetch(`${BACKEND_URL}/api/generate-anschreiben`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          income:     parseInt(form.income),
          familySize: parseInt(form.familySize),
          maxRent:    parseInt(form.maxRent),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطای سرور");
      setResult(data.anschreiben);
      setStep(2);
    } catch (e) {
      setApiError(e.message || "خطای اتصال. دوباره امتحان کنید.");
    } finally {
      setLoading(false);
    }
  };

  // Download PDF
  const downloadPdf = async () => {
    setLoadingPdf(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/generate-bewerbungsmappe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          income:     parseInt(form.income),
          familySize: parseInt(form.familySize),
          maxRent:    parseInt(form.maxRent),
          anschreiben: result,
        }),
      });
      if (!res.ok) throw new Error("خطا در ساخت PDF");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `Bewerbungsmappe_${form.lastName}_${form.firstName}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setApiError(e.message);
    } finally {
      setLoadingPdf(false);
    }
  };

  const copyText = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => { setStep(0); setForm(EMPTY_FORM); setResult(""); setApiError(""); setErrors({}); };

  const S = (k) => errors[k] ? inputErr : inputStyle;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        body { background:#F5F1EA; }
        .btn-p { background:#1A1A2E; color:#fff; border:none; padding:13px 28px; border-radius:12px; font-size:15px; font-family:Vazirmatn,sans-serif; font-weight:700; cursor:pointer; transition:all 0.2s; width:100%; }
        .btn-p:hover:not(:disabled) { background:#C8A97E; transform:translateY(-1px); }
        .btn-p:disabled { opacity:0.5; cursor:not-allowed; }
        .btn-s { background:transparent; color:#1A1A2E; border:1.5px solid #1A1A2E; padding:11px 24px; border-radius:12px; font-size:14px; font-family:Vazirmatn,sans-serif; font-weight:600; cursor:pointer; transition:all 0.2s; }
        .btn-s:hover { background:#1A1A2E; color:#fff; }
        .btn-gold { background:#C8A97E; color:#1A1A2E; border:none; padding:11px 24px; border-radius:12px; font-size:14px; font-family:Vazirmatn,sans-serif; font-weight:700; cursor:pointer; transition:all 0.2s; }
        .btn-gold:hover:not(:disabled) { background:#b8956a; }
        .btn-gold:disabled { opacity:0.5; cursor:not-allowed; }
        input:focus,select:focus,textarea:focus { border-color:#C8A97E !important; background:#fff !important; }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>

      <div style={{ minHeight:"100vh", background:"#F5F1EA", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"40px 16px" }}>
        <div style={{ width:"100%", maxWidth:520 }}>

          {/* Header */}
          <div style={{ textAlign:"center", marginBottom:36 }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:10, background:"#1A1A2E", borderRadius:16, padding:"10px 20px", marginBottom:16 }}>
              <span style={{ fontSize:24 }}>🏠</span>
              <span style={{ color:"#C8A97E", fontWeight:800, fontSize:20, fontFamily:"Vazirmatn,sans-serif" }}>Wohnung Bot</span>
            </div>
            <p style={{ color:"#666", fontSize:13, fontFamily:"Vazirmatn,sans-serif", direction:"rtl" }}>
              متن درخواست حرفه‌ای آلمانی + Bewerbungsmappe PDF
            </p>
          </div>

          {/* Card */}
          <div style={{ background:"#fff", borderRadius:24, padding:"32px 28px", boxShadow:"0 4px 24px rgba(0,0,0,0.07)" }}>
            <StepIndicator current={step} />

            {/* ── STEP 0 ── */}
            {step === 0 && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
                  <h2 style={{ fontSize:18, fontFamily:"Vazirmatn,sans-serif", color:"#1A1A2E", direction:"rtl" }}>اطلاعات شخصی</h2>
                  <span style={{ background:"#e8f5e9", color:"#2e7d32", borderRadius:20, padding:"3px 12px", fontSize:11, fontWeight:700, fontFamily:"Vazirmatn,sans-serif" }}>رایگان</span>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                  <Field label="نام" error={errors.firstName}>
                    <input style={S("firstName")} placeholder="علی" value={form.firstName} onChange={e => upd("firstName", e.target.value)} />
                  </Field>
                  <Field label="نام خانوادگی" error={errors.lastName}>
                    <input style={S("lastName")} placeholder="رضایی" value={form.lastName} onChange={e => upd("lastName", e.target.value)} />
                  </Field>
                </div>

                <Field label="شغل" hint="به آلمانی یا انگلیسی: Ingenieur, Krankenpfleger..." error={errors.job}>
                  <input style={S("job")} placeholder="Ingenieur" value={form.job} onChange={e => upd("job", e.target.value)} />
                </Field>

                <Field label="درآمد ماهانه خالص (€)" hint="Nettoeinkommen — بعد از کسر مالیات" error={errors.income}>
                  <input style={S("income")} type="number" placeholder="2500" value={form.income} onChange={e => upd("income", e.target.value)} />
                </Field>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                  <Field label="تعداد نفر خانوار">
                    <select style={inputStyle} value={form.familySize} onChange={e => upd("familySize", e.target.value)}>
                      {["1","2","3","4","5","6"].map(n => <option key={n} value={n}>{n} نفر</option>)}
                    </select>
                  </Field>
                  <Field label="حیوان خانگی؟">
                    <select style={inputStyle} value={form.hasPets} onChange={e => upd("hasPets", e.target.value === "true")}>
                      <option value="false">خیر</option>
                      <option value="true">بله</option>
                    </select>
                  </Field>
                </div>

                <button className="btn-p" onClick={goStep1}>بعدی ←</button>
              </div>
            )}

            {/* ── STEP 1 ── */}
            {step === 1 && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
                  <h2 style={{ fontSize:18, fontFamily:"Vazirmatn,sans-serif", color:"#1A1A2E", direction:"rtl" }}>مشخصات خانه</h2>
                  <span style={{ background:"#e8f5e9", color:"#2e7d32", borderRadius:20, padding:"3px 12px", fontSize:11, fontWeight:700, fontFamily:"Vazirmatn,sans-serif" }}>رایگان</span>
                </div>

                <Field label="شهر" error={errors.city}>
                  <select style={S("city")} value={form.city} onChange={e => upd("city", e.target.value)}>
                    <option value="">انتخاب کنید...</option>
                    {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                  <Field label="حداکثر اجاره (€/ماه)" error={errors.maxRent}>
                    <input style={S("maxRent")} type="number" placeholder="1200" value={form.maxRent} onChange={e => upd("maxRent", e.target.value)} />
                  </Field>
                  <Field label="تعداد اتاق‌ها">
                    <select style={inputStyle} value={form.rooms} onChange={e => upd("rooms", e.target.value)}>
                      {["1","1.5","2","2.5","3","3.5","4","4+"].map(n => <option key={n} value={n}>{n} اتاق</option>)}
                    </select>
                  </Field>
                </div>

                <Field label="تاریخ نقل مکان" error={errors.moveDate}>
                  <input style={S("moveDate")} type="date" value={form.moveDate} onChange={e => upd("moveDate", e.target.value)} />
                </Field>

                <Field label="توضیح اضافی (اختیاری)" hint="هر چیزی که می‌خواهید موجر بداند">
                  <textarea style={{ ...inputStyle, height:76, resize:"vertical" }}
                    placeholder="مثلاً: غیرسیگاری، کار از راه دور، مستأجر قبلاً هیچ مشکلی نداشته..."
                    value={form.extraNote} onChange={e => upd("extraNote", e.target.value)} />
                </Field>

                {apiError && (
                  <div style={{ background:"#fff3f3", border:"1px solid #ffcdd2", borderRadius:10, padding:"10px 14px", marginBottom:16, color:"#c62828", fontFamily:"Vazirmatn,sans-serif", fontSize:13, direction:"rtl" }}>
                    ❌ {apiError}
                  </div>
                )}

                <div style={{ display:"flex", gap:10 }}>
                  <button className="btn-s" onClick={() => setStep(0)} style={{ flex:1 }}>→ قبلی</button>
                  <button className="btn-p" style={{ flex:2 }} disabled={loading} onClick={generate}>
                    {loading
                      ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                          <span style={{ width:16, height:16, border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.8s linear infinite", display:"inline-block" }} />
                          در حال ساخت...
                        </span>
                      : "✨ ساخت متن درخواست"}
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && result && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                  <h2 style={{ fontSize:18, fontFamily:"Vazirmatn,sans-serif", color:"#1A1A2E", direction:"rtl" }}>متن آماده شد ✅</h2>
                  <span style={{ background:"#e8f5e9", color:"#2e7d32", borderRadius:20, padding:"3px 12px", fontSize:11, fontWeight:700, fontFamily:"Vazirmatn,sans-serif" }}>رایگان</span>
                </div>

                <div style={{ background:"#faf9f7", borderRadius:14, padding:24, border:"1.5px solid #e8e2d8", whiteSpace:"pre-wrap", fontFamily:"Georgia,serif", fontSize:13.5, lineHeight:1.9, color:"#2a2a2a", direction:"ltr", textAlign:"left", marginBottom:16 }}>
                  {result}
                </div>

                <div style={{ display:"flex", gap:10, marginBottom:16 }}>
                  <button className="btn-s" style={{ flex:1 }} onClick={reset}>🔄 شروع مجدد</button>
                  <button className="btn-p"  style={{ flex:1 }} onClick={copyText}>
                    {copied ? "✓ کپی شد!" : "📋 کپی متن"}
                  </button>
                </div>

                {/* PDF button */}
                <button className="btn-gold" style={{ width:"100%", marginBottom:24 }} disabled={loadingPdf} onClick={downloadPdf}>
                  {loadingPdf
                    ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                        <span style={{ width:15, height:15, border:"2px solid rgba(0,0,0,0.2)", borderTopColor:"#1A1A2E", borderRadius:"50%", animation:"spin 0.8s linear infinite", display:"inline-block" }} />
                        در حال ساخت PDF...
                      </span>
                    : "📁 دانلود Bewerbungsmappe PDF"}
                </button>

                {/* Premium upsell */}
                <div style={{ background:"linear-gradient(135deg,#1A1A2E 0%,#2d2d4e 100%)", borderRadius:16, padding:20, textAlign:"center" }}>
                  <p style={{ color:"#C8A97E", fontWeight:700, fontSize:14, fontFamily:"Vazirmatn,sans-serif", marginBottom:6 }}>⚡ پریمیوم — به زودی</p>
                  <p style={{ color:"rgba(255,255,255,0.7)", fontSize:12, fontFamily:"Vazirmatn,sans-serif", marginBottom:12, direction:"rtl", lineHeight:1.7 }}>
                    🔔 هشدار فوری آگهی‌های ImmoScout24 و Kleinanzeigen در کمتر از ۳۰ ثانیه
                  </p>
                  <div style={{ display:"flex", gap:6, justifyContent:"center", flexWrap:"wrap", marginBottom:14 }}>
                    {["🔔 هشدار آنی","📁 Mappe کامل","🤖 ارسال سریع"].map(f => (
                      <span key={f} style={{ background:"rgba(200,169,126,0.15)", color:"#C8A97E", borderRadius:20, padding:"3px 10px", fontSize:11, fontFamily:"Vazirmatn,sans-serif", border:"1px solid rgba(200,169,126,0.3)" }}>{f}</span>
                    ))}
                  </div>
                  <div style={{ background:"rgba(255,255,255,0.08)", borderRadius:10, padding:"8px 14px" }}>
                    <p style={{ color:"rgba(255,255,255,0.5)", fontSize:11, fontFamily:"Vazirmatn,sans-serif" }}>
                      🚧 سیستم اسکرپینگ ImmoScout24 در دست توسعه
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <p style={{ textAlign:"center", marginTop:16, fontSize:11, color:"#aaa", fontFamily:"Vazirmatn,sans-serif" }}>
            Wohnung Bot v2 • API calls secured via backend
          </p>
        </div>
      </div>
    </>
  );
}
