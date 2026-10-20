// Custom (homebrew) Shadow Amps built in the Amp Creator, persisted to
// localStorage — same approach as dice/history.js, but entries need
// individual deletion rather than just "clear all", so each gets an id.

const CUSTOM_AMPS_KEY = "shadowbook-custom-amps";

export function loadCustomAmps() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_AMPS_KEY)) || [];
  } catch {
    return [];
  }
}

function persist(amps) {
  try {
    localStorage.setItem(CUSTOM_AMPS_KEY, JSON.stringify(amps));
  } catch {
    // Won't persist (e.g. private browsing with storage blocked).
  }
}

export function saveCustomAmp(amp) {
  const amps = loadCustomAmps();
  amps.unshift({ ...amp, id: crypto.randomUUID() });
  persist(amps);
}

export function deleteCustomAmp(id) {
  persist(loadCustomAmps().filter((amp) => amp.id !== id));
}

export function updateCustomAmp(id, amp) {
  persist(
    loadCustomAmps().map((existing) =>
      existing.id === id ? { ...amp, id } : existing,
    ),
  );
}

export function getCustomAmp(id) {
  return loadCustomAmps().find((amp) => amp.id === id);
}
