/**
 * IDs numéricos positivos (1, 2, 3…) vindos de query/body/params.
 * @param {unknown} raw
 * @returns {number | null}
 */
export function parsePositiveInt(raw) {
  if (raw == null || raw === "") return null
  const n =
    typeof raw === "number" && Number.isInteger(raw)
      ? raw
      : parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || n < 1) return null
  return n
}
