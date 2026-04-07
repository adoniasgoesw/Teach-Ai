import { useCallback, useEffect, useState } from "react"
import { getAccountSummary, getCreditTransactions } from "../services/api"
import { CREDITS_UPDATED_EVENT } from "../lib/creditsEvents"

/**
 * Carrega resumo da conta + transações; reage a teachai:credits-updated.
 */
export function useBillingData(userId) {
  const [summary, setSummary] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const uid = userId != null ? String(userId).trim() : ""

  const load = useCallback(async () => {
    if (!uid) {
      setSummary(null)
      setTransactions([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [s, txData] = await Promise.all([
        getAccountSummary(uid),
        getCreditTransactions(uid, 100),
      ])
      setSummary(s)
      setTransactions(Array.isArray(txData?.transactions) ? txData.transactions : [])
    } catch (e) {
      const msg =
        e?.response?.data?.message || e?.message || "Erro ao carregar dados."
      setError(msg)
      setSummary(null)
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }, [uid])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    function onRefresh() {
      void load()
    }
    window.addEventListener(CREDITS_UPDATED_EVENT, onRefresh)
    return () => window.removeEventListener(CREDITS_UPDATED_EVENT, onRefresh)
  }, [load])

  return { summary, transactions, loading, error, reload: load }
}
