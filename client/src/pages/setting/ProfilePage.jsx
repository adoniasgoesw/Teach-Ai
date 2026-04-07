import { useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { getUserProfile } from "../../services/api"
import { formatDatePt } from "../../lib/creditUi"

export default function ProfilePage() {
    const { user: ctxUser } = useOutletContext()
    const userId = ctxUser?.id != null ? String(ctxUser.id).trim() : ""

    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (!userId) {
            setProfile(null)
            setLoading(false)
            return
        }
        let cancelled = false
        setLoading(true)
        setError(null)
        getUserProfile(userId)
            .then((data) => {
                if (cancelled) return
                setProfile(data?.user ?? null)
            })
            .catch((e) => {
                if (cancelled) return
                setError(
                    e?.response?.data?.message ||
                        e?.message ||
                        "Não foi possível carregar o perfil."
                )
                setProfile(null)
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [userId])

    const name =
        profile?.name?.trim() || ctxUser?.name?.trim() || "—"
    const email =
        profile?.email?.trim() || ctxUser?.email?.trim() || "—"
    const memberSince = profile?.createdAt
        ? formatDatePt(profile.createdAt)
        : "—"

    return (
        <div className="max-w-xl space-y-8">
            <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-600 mb-1">
                    Conta
                </p>
                <h1 className="text-2xl font-light text-neutral-900">Perfil</h1>
                <p className="text-sm text-neutral-500 mt-1">
                    Dados lidos da API (tabela User).
                </p>
            </div>

            {error && (
                <p className="text-sm text-red-600 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                    {error}
                </p>
            )}

            {loading && (
                <p className="text-sm text-neutral-500">Carregando perfil…</p>
            )}

            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-5">
                <div>
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                        ID
                    </p>
                    <p className="text-sm text-neutral-900 font-mono">
                        {userId || "—"}
                    </p>
                </div>
                <div>
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                        Nome
                    </p>
                    <p className="text-base text-neutral-900">{name}</p>
                </div>
                <div>
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                        E-mail
                    </p>
                    <p className="text-base text-neutral-900 break-all">
                        {email}
                    </p>
                </div>
                <div>
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                        Membro desde
                    </p>
                    <p className="text-base text-neutral-900">{memberSince}</p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <button
                    type="button"
                    disabled
                    className="rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-2.5 text-sm font-medium text-neutral-400 cursor-not-allowed"
                >
                    Editar dados (em breve)
                </button>
                <button
                    type="button"
                    disabled
                    className="rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-2.5 text-sm font-medium text-neutral-400 cursor-not-allowed"
                >
                    Alterar senha (em breve)
                </button>
            </div>
        </div>
    )
}
