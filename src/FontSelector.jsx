import { HEBREW_FONTS } from './fonts'

export default function FontSelector({ value, onChange }) {
  return (
    <div className="font-settings" dir="ltr">
      <div className="font-label">
        <label htmlFor="hebrew-font">Hebrew font</label>
        <span className="font-preview" lang="he" dir="rtl" aria-hidden="true">אבגדה</span>
      </div>
      <select id="hebrew-font" value={value} onChange={(event) => onChange(event.target.value)}>
        {HEBREW_FONTS.map((font) => <option key={font.id} value={font.id}>{font.style} — {font.name}</option>)}
      </select>
    </div>
  )
}
