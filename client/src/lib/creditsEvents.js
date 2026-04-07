/** Disparado após consumo ou recarga de créditos para alinhar Header e outras telas ao banco. */
export const CREDITS_UPDATED_EVENT = "teachai:credits-updated"

export function notifyCreditsUpdated() {
    if (typeof window === "undefined") return
    window.dispatchEvent(new CustomEvent(CREDITS_UPDATED_EVENT))
}
