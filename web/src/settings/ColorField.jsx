// Seletor de cor: presets + últimas escolhidas (recentes) + picker livre.
//
// Componente de apresentação: recebe tudo por props, não lê definições nem
// guarda nada (DIP). O estado vive no `SettingsContext`.
export default function ColorField({ presets, value, recent, onPick, onCommit, fallback }) {
  const norm = (value || "").toLowerCase();
  const presetSet = new Set(presets.map((c) => c.toLowerCase()));
  const recentExtra = (recent || []).filter((c) => !presetSet.has(c.toLowerCase()));
  return (
    <div className="set-row color-row">
      {presets.map((c) => (
        <button
          key={c}
          className={`color-swatch ${norm === c.toLowerCase() ? "active" : ""}`}
          style={{ background: c }}
          onClick={() => onPick(c)}
          aria-label={c}
        />
      ))}
      {recentExtra.map((c) => (
        <button
          key={c}
          className={`color-swatch recent ${norm === c.toLowerCase() ? "active" : ""}`}
          style={{ background: c }}
          onClick={() => onPick(c)}
          title={`Recente: ${c}`}
          aria-label={`Recente ${c}`}
        />
      ))}
      <label className="color-custom" style={{ background: value }}>
        <input
          type="color"
          value={value || fallback}
          onChange={(e) => onPick(e.target.value)}
          onBlur={(e) => onCommit(e.target.value)}
        />
        <span>+</span>
      </label>
    </div>
  );
}