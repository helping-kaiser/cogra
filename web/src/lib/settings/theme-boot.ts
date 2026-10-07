// The theme's first-paint rule, shared by the server-rendered document head
// and the client store (`device-preference.ts`). Plain constants, so the
// root layout — a server component — reads them as strings rather than as
// client references.

/** Where the device-local theme choice lives (`localStorage`). */
export const THEME_STORAGE_KEY = "cogra.theme";

/**
 * Run in the document head before the first paint, so a chosen theme never
 * flashes the other one: it reads the one key and sets the one attribute the
 * stylesheet keys on (`globals.css`). Auto leaves the attribute off, where the
 * media query follows the device.
 */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
