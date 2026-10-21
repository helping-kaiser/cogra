// The first-paint rules for the device-local reading choices, shared by the
// server-rendered document head and the client store
// (`device-preference.ts`). Plain constants, so the root layout — a server
// component — reads them as strings rather than as client references.

/** Where the device-local theme choice lives (`localStorage`). */
export const THEME_STORAGE_KEY = "cogra.theme";

/** Where the device-local Show exact values choice lives (`localStorage`). */
export const EXACT_VALUES_STORAGE_KEY = "cogra.exactValues";

/**
 * Run in the document head before the first paint, so a chosen theme never
 * flashes the other one and a reader who asked for the digits never sees a
 * frame without them: it reads the two keys and sets the two attributes the
 * stylesheet keys on (`globals.css`). Auto leaves `data-theme` off, where the
 * media query follows the device; geek mode off leaves `data-geek` off, where
 * every `.cg-exact` span stays unpainted (design/readme.md §13, "One markup,
 * two paintings").
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;if(localStorage.getItem(${JSON.stringify(
  EXACT_VALUES_STORAGE_KEY,
)})==="on")document.documentElement.dataset.geek="on"}catch(e){}`;
