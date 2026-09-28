export const HEBREW_FONT_KEY = 'hebrew-five:hebrew-font:v1'
export const DEFAULT_HEBREW_FONT = 'sans'

export const HEBREW_FONTS = [
  {
    id: 'script',
    name: 'Playpen Sans Hebrew',
    style: 'Script',
    family: '"Playpen Sans Hebrew", "Arial Hebrew", cursive',
    weight: 500,
  },
  {
    id: 'sans',
    name: 'Varela Round',
    style: 'Sans-serif',
    family: '"Varela Round", "Arial Hebrew", Arial, sans-serif',
    weight: 400,
  },
  {
    id: 'serif',
    name: 'Frank Ruhl Libre',
    style: 'Serif',
    family: '"Frank Ruhl Libre", "Noto Serif Hebrew", "Times New Roman", serif',
    weight: 600,
  },
]

export function getHebrewFont(id) {
  return HEBREW_FONTS.find((font) => font.id === id)
    || HEBREW_FONTS.find((font) => font.id === DEFAULT_HEBREW_FONT)
}
