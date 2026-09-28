import { HEBREW_FONTS } from './fonts'

export default function FontSelector({ value, onChange }) {
  return (
    <div className="font-settings" dir="ltr">
      <select id="hebrew-font" aria-label="Hebrew font" value={value} onChange={(event) => onChange(event.target.value)}>
        {HEBREW_FONTS.map((font) => <option key={font.id} value={font.id}>{font.style} — {font.name}</option>)}
      </select>
    </div>
  )
}
