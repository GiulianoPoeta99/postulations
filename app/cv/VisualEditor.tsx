"use client";

import { useEffect, useState, useMemo } from "react";
import { parse, stringify } from "yaml";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight, Globe } from "lucide-react";

type BilingualString = { en: string; es: string };
type TextValue = string | BilingualString;

// Utility to read a bilingual string safely
const getLangText = (val: TextValue, lang: "en" | "es") => {
  if (!val) return "";
  if (typeof val === "string") return val;
  return val[lang] || "";
};

// Utility to write a bilingual string safely
const setLangText = (val: TextValue, lang: "en" | "es", newText: string): TextValue => {
  if (typeof val === "string") {
    if (lang === "en" && newText === val) return val;
    if (lang === "es" && newText === val) return val;
    // Upgrade to bilingual
    return { en: lang === "en" ? newText : val, es: lang === "es" ? newText : val };
  }
  const obj = { ...(val || { en: "", es: "" }) };
  obj[lang] = newText;
  
  return obj;
};

function isBilingual(val: any): val is BilingualString {
  return typeof val === "object" && val !== null && ("en" in val || "es" in val);
}

function detectBilingual(obj: any, depth = 0): boolean {
  if (depth > 10) return false;
  if (typeof obj !== 'object' || obj === null) return false;
  if (('en' in obj) && ('es' in obj) && Object.keys(obj).length <= 2) return true;
  for (const key in obj) {
    if (detectBilingual(obj[key], depth + 1)) return true;
  }
  return false;
}

function BilingualInput({ value, onChange, placeholder, multiline = false, isBilingualMode = false }: {
  value: TextValue;
  onChange: (v: TextValue) => void;
  placeholder?: string;
  multiline?: boolean;
  isBilingualMode?: boolean;
}) {
  if (isBilingualMode) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', width: '100%' }}>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <span style={{ position: 'absolute', left: 10, top: multiline ? 12 : '50%', transform: multiline ? 'none' : 'translateY(-50%)', fontSize: 11, color: 'var(--muted)', fontWeight: 'bold', pointerEvents: 'none' }}>EN</span>
          {multiline ? (
            <textarea
              value={getLangText(value, "en")}
              onChange={e => onChange(setLangText(value, "en", e.target.value))}
              placeholder={placeholder}
              rows={3}
              style={{ paddingLeft: 34, width: '100%', boxSizing: 'border-box' }}
            />
          ) : (
            <input
              type="text"
              value={getLangText(value, "en")}
              onChange={e => onChange(setLangText(value, "en", e.target.value))}
              placeholder={placeholder}
              style={{ paddingLeft: 34, width: '100%', boxSizing: 'border-box' }}
            />
          )}
        </div>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <span style={{ position: 'absolute', left: 10, top: multiline ? 12 : '50%', transform: multiline ? 'none' : 'translateY(-50%)', fontSize: 11, color: 'var(--muted)', fontWeight: 'bold', pointerEvents: 'none' }}>ES</span>
          {multiline ? (
            <textarea
              value={getLangText(value, "es")}
              onChange={e => onChange(setLangText(value, "es", e.target.value))}
              placeholder={placeholder}
              rows={3}
              style={{ paddingLeft: 34, width: '100%', boxSizing: 'border-box' }}
            />
          ) : (
            <input
              type="text"
              value={getLangText(value, "es")}
              onChange={e => onChange(setLangText(value, "es", e.target.value))}
              placeholder={placeholder}
              style={{ paddingLeft: 34, width: '100%', boxSizing: 'border-box' }}
            />
          )}
        </div>
      </div>
    );
  }

  // Single language mode (just edits whatever it is, or English if bilingual)
  const displayVal = typeof value === "string" ? value : getLangText(value, "es");
  
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
      {multiline ? (
        <textarea
          value={displayVal}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          style={{ width: '100%', boxSizing: 'border-box' }}
        />
      ) : (
        <input
          type="text"
          value={displayVal}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ width: '100%', boxSizing: 'border-box' }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------
// Unified Models
// ----------------------------------------------------

type UnifiedSection = {
  id: string;
  title: TextValue;
  entries: any[];
};

export function VisualEditor({ yamlContent, onChange }: { yamlContent: string; onChange: (v: string) => void }) {
  const [bilingualMode, setBilingualMode] = useState(true);
  
  // Editor State
  const [cvName, setCvName] = useState("");
  const [cvLocation, setCvLocation] = useState("");
  const [cvEmail, setCvEmail] = useState("");
  const [cvPhone, setCvPhone] = useState("");
  const [cvSocials, setCvSocials] = useState<{ network: string; username: string }[]>([]);
  const [sections, setSections] = useState<UnifiedSection[]>([]);
  
  // We keep the rest of the yaml untouched (design, locale, settings)
  const [rawParsed, setRawParsed] = useState<any>(null);

  // Initialize from YAML
  useEffect(() => {
    try {
      const obj = parse(yamlContent);
      if (!obj || !obj.cv) return;
      
      setRawParsed(obj);
      setCvName(obj.cv.name || "");
      setCvLocation(obj.cv.location || "");
      setCvEmail(obj.cv.email || "");
      setCvPhone(obj.cv.phone || "");
      setCvSocials(obj.cv.social_networks || []);

      // Parse Sections
      const s = obj.cv.sections;
      const parsedSections: UnifiedSection[] = [];
      
      if (s) {
        if (s.en || s.es) {
          // Bilingual root
          setBilingualMode(true);
          const enKeys = s.en ? Object.keys(s.en) : [];
          const esKeys = s.es ? Object.keys(s.es) : [];
          
          const maxLen = Math.max(enKeys.length, esKeys.length);
          for (let i = 0; i < maxLen; i++) {
            const enK = enKeys[i] || esKeys[i];
            const esK = esKeys[i] || enKeys[i];
            
            // We use English entries as the source of truth if available
            const entries = (s.en && s.en[enK]) || (s.es && s.es[esK]) || [];
            
            parsedSections.push({
              id: Math.random().toString(36).substr(2, 9),
              title: { en: enK, es: esK },
              entries: Array.isArray(entries) ? [...entries] : [entries]
            });
          }
        } else {
          // Normal single language structure for sections
          // Auto-detect if there's bilingual data inside
          if (detectBilingual(s)) {
            setBilingualMode(true);
          } else {
            setBilingualMode(false);
          }

          for (const key of Object.keys(s)) {
            const entries = s[key];
            parsedSections.push({
              id: Math.random().toString(36).substr(2, 9),
              title: key, // Can be converted to bilingual by BilingualInput later
              entries: Array.isArray(entries) ? [...entries] : [entries]
            });
          }
        }
      }
      
      setSections(parsedSections);
    } catch (e) {
      console.error("Failed to parse YAML for visual editor", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount to read from yamlContent once

  // Sync back to YAML when state changes
  const saveToYaml = () => {
    if (!rawParsed) return;
    
    const newObj = { ...rawParsed };
    if (!newObj.cv) newObj.cv = {};
    
    newObj.cv.name = cvName;
    newObj.cv.location = cvLocation;
    newObj.cv.email = cvEmail;
    newObj.cv.phone = cvPhone;
    newObj.cv.social_networks = cvSocials;
    
    // We remove shared_data to flatten the structure, making it safer to edit visually
    if (newObj.cv.shared_data) {
      delete newObj.cv.shared_data;
    }

    // Reconstruct sections
    if (bilingualMode) {
      newObj.cv.sections = { en: {}, es: {} };
      for (const sec of sections) {
        const enTitle = getLangText(sec.title, "en") || "Section";
        const esTitle = getLangText(sec.title, "es") || enTitle;
        // Clean entries from nulls/empty objects just in case
        newObj.cv.sections.en[enTitle] = sec.entries;
        newObj.cv.sections.es[esTitle] = sec.entries;
      }
    } else {
      newObj.cv.sections = {};
      for (const sec of sections) {
        const title = typeof sec.title === "string" ? sec.title : (sec.title.es || sec.title.en || "Section");
        newObj.cv.sections[title] = sec.entries;
      }
    }

    try {
      const newYaml = stringify(newObj, { aliasDuplicateObjects: false });
      onChange(newYaml);
    } catch (e) {
      console.error("Failed to stringify", e);
    }
  };

  // Debounced auto-save
  useEffect(() => {
    if (!rawParsed) return;
    const t = setTimeout(() => {
      saveToYaml();
    }, 1200); // 1.2s debounce to prevent spamming compilation
    return () => clearTimeout(t);
  }, [cvName, cvLocation, cvEmail, cvPhone, cvSocials, sections, bilingualMode]);


  // -------------------------------------------
  // Handlers
  // -------------------------------------------

  const addSocial = () => {
    setCvSocials([...cvSocials, { network: "LinkedIn", username: "" }]);
  };

  const removeSocial = (idx: number) => {
    const s = [...cvSocials];
    s.splice(idx, 1);
    setCvSocials(s);
  };

  const updateSocial = (idx: number, field: string, val: string) => {
    const s = [...cvSocials];
    s[idx] = { ...s[idx], [field]: val };
    setCvSocials(s);
  };

  const addSection = () => {
    setSections([...sections, { id: Math.random().toString(), title: "Nueva Sección", entries: [] }]);
  };
  
  const removeSection = (idx: number) => {
    const s = [...sections];
    s.splice(idx, 1);
    setSections(s);
  };

  const updateSectionTitle = (idx: number, val: TextValue) => {
    const s = [...sections];
    s[idx].title = val;
    setSections(s);
  };

  const addEntry = (secIdx: number, type: string) => {
    const s = [...sections];
    let newEntry: any = {};
    if (type === "experience") {
      newEntry = { company: "", position: "", start_date: "", end_date: "", summary: "", highlights: [] };
    } else if (type === "education") {
      newEntry = { institution: "", area: "", degree: "", start_date: "", end_date: "", highlights: [] };
    } else if (type === "normal") {
      newEntry = { name: "", start_date: "", end_date: "", summary: "", highlights: [] };
    } else if (type === "one_line") {
      newEntry = { label: "", details: "" };
    } else if (type === "text") {
      newEntry = ""; // Summary section usually just has strings
    }
    s[secIdx].entries.push(newEntry);
    setSections(s);
  };

  const removeEntry = (secIdx: number, entIdx: number) => {
    const s = [...sections];
    s[secIdx].entries.splice(entIdx, 1);
    setSections(s);
  };

  const updateEntry = (secIdx: number, entIdx: number, field: string | null, val: any) => {
    const s = [...sections];
    if (field === null) {
      // It's a raw string entry (like in Summary)
      s[secIdx].entries[entIdx] = val;
    } else {
      s[secIdx].entries[entIdx] = { ...s[secIdx].entries[entIdx], [field]: val };
    }
    setSections(s);
  };

  // Component to render different entry types
  const EntryForm = ({ secIdx, entIdx, entry }: { secIdx: number, entIdx: number, entry: any }) => {
    if (typeof entry === "string" || isBilingual(entry)) {
      return (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', width: '100%', background: 'var(--surface)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border-color)' }}>
          <div style={{ flex: 1 }}>
            <BilingualInput value={entry} onChange={v => updateEntry(secIdx, entIdx, null, v)} multiline isBilingualMode={bilingualMode} />
          </div>
          <button className="icon-button danger" onClick={() => removeEntry(secIdx, entIdx)} title="Eliminar texto"><Trash2 size={16}/></button>
        </div>
      );
    }
    
    // Auto-detect type
    const isExp = "company" in entry;
    const isEdu = "institution" in entry;
    const isOneLine = "label" in entry;
    
    return (
      <div style={{ border: '1px solid var(--border-color)', padding: '1.25rem', borderRadius: 8, background: 'var(--surface)', display: 'flex', gap: '1.25rem', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
           <span style={{ fontSize: '0.85em', color: 'var(--primary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
             {isExp ? "Experiencia" : isEdu ? "Educación" : isOneLine ? "Habilidad / 1 línea" : "Proyecto / Otro"}
           </span>
           <button className="icon-button danger compact-button" onClick={() => removeEntry(secIdx, entIdx)} title="Eliminar ítem"><Trash2 size={14}/></button>
        </div>
        
        {isExp && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <label className="field"><span>Empresa</span><BilingualInput value={entry.company || ""} onChange={v => updateEntry(secIdx, entIdx, "company", v)} isBilingualMode={bilingualMode}/></label>
              <label className="field"><span>Puesto</span><BilingualInput value={entry.position || ""} onChange={v => updateEntry(secIdx, entIdx, "position", v)} isBilingualMode={bilingualMode}/></label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <label className="field"><span>Inicio</span><input value={entry.start_date || ""} onChange={e => updateEntry(secIdx, entIdx, "start_date", e.target.value)} /></label>
              <label className="field"><span>Fin</span><input value={entry.end_date || ""} onChange={e => updateEntry(secIdx, entIdx, "end_date", e.target.value)} /></label>
              <label className="field"><span>Ubicación</span><input value={entry.location || ""} onChange={e => updateEntry(secIdx, entIdx, "location", e.target.value)} /></label>
            </div>
            <label className="field"><span>Resumen</span><BilingualInput value={entry.summary || ""} onChange={v => updateEntry(secIdx, entIdx, "summary", v)} multiline isBilingualMode={bilingualMode}/></label>
          </div>
        )}

        {isEdu && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <label className="field"><span>Institución</span><BilingualInput value={entry.institution || ""} onChange={v => updateEntry(secIdx, entIdx, "institution", v)} isBilingualMode={bilingualMode}/></label>
              <label className="field"><span>Título / Grado</span><BilingualInput value={entry.degree || ""} onChange={v => updateEntry(secIdx, entIdx, "degree", v)} isBilingualMode={bilingualMode}/></label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <label className="field"><span>Área de Estudio</span><BilingualInput value={entry.area || ""} onChange={v => updateEntry(secIdx, entIdx, "area", v)} isBilingualMode={bilingualMode}/></label>
              <label className="field"><span>Inicio</span><input value={entry.start_date || ""} onChange={e => updateEntry(secIdx, entIdx, "start_date", e.target.value)} /></label>
              <label className="field"><span>Fin</span><input value={entry.end_date || ""} onChange={e => updateEntry(secIdx, entIdx, "end_date", e.target.value)} /></label>
            </div>
          </div>
        )}
        
        {isOneLine && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <label className="field"><span>Etiqueta</span><BilingualInput value={entry.label || ""} onChange={v => updateEntry(secIdx, entIdx, "label", v)} isBilingualMode={bilingualMode}/></label>
            <label className="field"><span>Detalles</span><BilingualInput value={entry.details || ""} onChange={v => updateEntry(secIdx, entIdx, "details", v)} multiline isBilingualMode={bilingualMode}/></label>
          </div>
        )}

        {(!isExp && !isEdu && !isOneLine) && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <label className="field"><span>Nombre del Proyecto / Elemento</span><BilingualInput value={entry.name || ""} onChange={v => updateEntry(secIdx, entIdx, "name", v)} isBilingualMode={bilingualMode}/></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <label className="field"><span>Inicio</span><input value={entry.start_date || ""} onChange={e => updateEntry(secIdx, entIdx, "start_date", e.target.value)} /></label>
              <label className="field"><span>Fin</span><input value={entry.end_date || ""} onChange={e => updateEntry(secIdx, entIdx, "end_date", e.target.value)} /></label>
            </div>
            <label className="field"><span>Resumen</span><BilingualInput value={entry.summary || ""} onChange={v => updateEntry(secIdx, entIdx, "summary", v)} multiline isBilingualMode={bilingualMode}/></label>
          </div>
        )}
      </div>
    );
  };

  if (!rawParsed) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando editor visual...</div>;
  }

  return (
    <div className="visual-editor" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1.5rem', overflowY: 'auto', height: '100%', background: 'var(--surface-soft)', border: '1px solid var(--border)', borderRadius: 8 }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, color: 'var(--foreground)' }}>Datos del Currículum</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9em', cursor: 'pointer', background: 'var(--surface)', padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid var(--border-color)', fontWeight: 'bold' }}>
          <Globe size={16} />
          <input type="checkbox" checked={bilingualMode} onChange={e => setBilingualMode(e.target.checked)} />
          Modo Bilingüe (EN/ES)
        </label>
      </div>

      <section style={{ background: 'var(--surface-soft)', padding: '1.5rem', borderRadius: 12, border: '1px solid var(--border-color)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1.25rem', color: 'var(--foreground)' }}>Datos Personales</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          <label className="field"><span>Nombre Completo</span><input value={cvName} onChange={e => setCvName(e.target.value)} /></label>
          <label className="field"><span>Ubicación</span><input value={cvLocation} onChange={e => setCvLocation(e.target.value)} /></label>
          <label className="field"><span>Correo Electrónico</span><input value={cvEmail} onChange={e => setCvEmail(e.target.value)} /></label>
          <label className="field"><span>Teléfono</span><input value={cvPhone} onChange={e => setCvPhone(e.target.value)} /></label>
        </div>

        <h3 style={{ marginTop: '2rem', marginBottom: '1rem', color: 'var(--foreground)' }}>Redes Sociales y Links</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {cvSocials.map((soc, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', gap: '1rem', alignItems: 'center' }}>
              <label className="field">
                {idx === 0 && <span>Plataforma</span>}
                <input value={soc.network} onChange={e => updateSocial(idx, "network", e.target.value)} placeholder="LinkedIn, GitHub..." />
              </label>
              <label className="field">
                {idx === 0 && <span>Usuario / Link</span>}
                <input value={soc.username} onChange={e => updateSocial(idx, "username", e.target.value)} placeholder="Ej. github.com/user" />
              </label>
              <div style={{ marginTop: idx === 0 ? '22px' : 0 }}>
                <button className="icon-button danger" onClick={() => removeSocial(idx)} title="Eliminar"><Trash2 size={16}/></button>
              </div>
            </div>
          ))}
        </div>
        <button className="secondary-button compact-button" onClick={addSocial} style={{ marginTop: '1rem' }}><Plus size={14} /> Añadir link</button>
      </section>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, color: 'var(--foreground)' }}>Secciones</h3>
          <button className="primary-button compact-button" onClick={addSection}>
            <Plus size={14} /> Nueva Sección
          </button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {sections.map((sec, secIdx) => (
            <div key={sec.id} style={{ border: '1px solid var(--border-color)', borderRadius: 12, background: 'var(--surface-soft)', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <div style={{ padding: '1rem 1.25rem', background: 'var(--surface)', display: 'flex', gap: '1rem', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
                <GripVertical size={16} color="var(--muted)" style={{ cursor: 'grab' }} />
                <label className="field" style={{ flex: 1, margin: 0, flexDirection: 'row', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ whiteSpace: 'nowrap', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.8em' }}>Título de Sección:</span>
                  <div style={{ flex: 1 }}>
                    <BilingualInput value={sec.title} onChange={v => updateSectionTitle(secIdx, v)} isBilingualMode={bilingualMode} />
                  </div>
                </label>
                <button className="icon-button danger" onClick={() => removeSection(secIdx)} title="Eliminar sección entera"><Trash2 size={16}/></button>
              </div>
              
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {sec.entries.map((entry, entIdx) => (
                  <EntryForm key={entIdx} secIdx={secIdx} entIdx={entIdx} entry={entry} />
                ))}
                
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center', background: 'var(--surface)', padding: '1rem', borderRadius: 8, border: '1px dashed var(--border-color)' }}>
                  <span style={{ fontSize: '0.9em', color: 'var(--primary)', display: 'flex', alignItems: 'center', fontWeight: 'bold', marginRight: '0.5rem' }}>
                    <Plus size={14} style={{marginRight: 6}}/> Añadir a esta sección:
                  </span>
                  <button className="secondary-button compact-button" onClick={() => addEntry(secIdx, "experience")}>Experiencia</button>
                  <button className="secondary-button compact-button" onClick={() => addEntry(secIdx, "education")}>Educación</button>
                  <button className="secondary-button compact-button" onClick={() => addEntry(secIdx, "one_line")}>Habilidad</button>
                  <button className="secondary-button compact-button" onClick={() => addEntry(secIdx, "normal")}>Proyecto / Otro</button>
                  <button className="secondary-button compact-button" onClick={() => addEntry(secIdx, "text")}>Texto Libre</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
