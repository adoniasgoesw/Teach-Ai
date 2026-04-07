import Button from "../buttons/Button"
import { useNavigate, Link } from "react-router-dom"
import { LogOutIcon, UserIcon, Settings, Zap, RefreshCw } from "lucide-react"
import { useState, useEffect, useRef, useCallback } from "react"
import { getCreditsWallet } from "../../services/api"
import {
    CREDITS_UPDATED_EVENT,
    notifyCreditsUpdated,
} from "../../lib/creditsEvents"

function readSessionUser() {
    try {
        const raw = window.localStorage.getItem("teachai:user")
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}

function creditsRemainingLabel(n) {
    if (n === null) return "…"
    if (n === 1) return "1 crédito restante"
    return `${n} créditos restantes`
}

export default function Header() {
    const [showMenu, setShowMenu] = useState(false)
    const [sessionUser, setSessionUser] = useState(() =>
        typeof window !== "undefined" ? readSessionUser() : null
    )
    const [walletBalance, setWalletBalance] = useState(null)
    const [walletRefreshing, setWalletRefreshing] = useState(false)
    const containerRef = useRef(null)
    const navigate = useNavigate()

    const loadWalletFromApi = useCallback(async () => {
        const u = readSessionUser()
        const uid = u?.id != null ? String(u.id).trim() : ""
        if (!uid) {
            setWalletBalance(null)
            return
        }
        try {
            const d = await getCreditsWallet(uid)
            if (typeof d?.balance === "number") setWalletBalance(d.balance)
            else setWalletBalance(0)
        } catch {
            setWalletBalance(null)
        }
    }, [])

    useEffect(() => {
        function refreshUser() {
            setSessionUser(readSessionUser())
        }
        window.addEventListener("storage", refreshUser)
        refreshUser()
        return () => window.removeEventListener("storage", refreshUser)
    }, [])

    useEffect(() => {
        void loadWalletFromApi()
    }, [sessionUser?.id, loadWalletFromApi])

    useEffect(() => {
        function onCreditsUpdated() {
            void loadWalletFromApi()
        }
        window.addEventListener(CREDITS_UPDATED_EVENT, onCreditsUpdated)
        return () =>
            window.removeEventListener(CREDITS_UPDATED_EVENT, onCreditsUpdated)
    }, [loadWalletFromApi])

    async function handleRefreshCredits(e) {
        e?.preventDefault?.()
        e?.stopPropagation?.()
        setWalletRefreshing(true)
        try {
            await loadWalletFromApi()
            notifyCreditsUpdated()
        } finally {
            setWalletRefreshing(false)
        }
    }

    useEffect(() => {
        function handleClickOutside(event) {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target)
            ) {
                setShowMenu(false)
            }
        }

        if (showMenu) {
            document.addEventListener("mousedown", handleClickOutside)
        } else {
            document.removeEventListener("mousedown", handleClickOutside)
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [showMenu])

    const displayName =
        sessionUser?.name?.trim() ||
        sessionUser?.email?.split("@")[0] ||
        "Conta"

    return (
        <header className="flex justify-between items-center w-full gap-4">
            <div
                ref={containerRef}
                className="flex justify-between items-center w-full relative flex-wrap gap-y-3"
            >
                <div className="min-w-0">
                    <h4 className="text-2xl font-light tracking-tight">
                        Teach AI
                    </h4>
                    <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-medium mt-0.5">
                        TeachAI Credits
                    </p>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 ml-auto">
                    {sessionUser && (
                        <div className="flex items-center gap-1 shrink-0">
                            <Link
                                to="/configuracao/usage"
                                className={
                                    walletBalance === 0
                                        ? "flex items-center gap-1.5 rounded-full border border-neutral-300 bg-neutral-100 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium text-neutral-700 hover:bg-neutral-200/80 transition-colors max-w-[48vw] sm:max-w-none"
                                        : "flex items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50/90 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium text-amber-950 hover:bg-amber-100/90 transition-colors max-w-[48vw] sm:max-w-none"
                                }
                                title="Ver uso e histórico de créditos"
                            >
                                <Zap
                                    className={
                                        walletBalance === 0
                                            ? "w-3.5 h-3.5 shrink-0 text-neutral-500"
                                            : "w-3.5 h-3.5 shrink-0 text-amber-600"
                                    }
                                />
                                <span className="tabular-nums">
                                    {creditsRemainingLabel(walletBalance)}
                                </span>
                            </Link>
                            <button
                                type="button"
                                onClick={handleRefreshCredits}
                                disabled={walletRefreshing}
                                className="rounded-full border border-neutral-200 bg-white p-1.5 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 disabled:opacity-50"
                                title="Atualizar saldo de créditos"
                                aria-label="Atualizar créditos"
                            >
                                <RefreshCw
                                    className={`w-3.5 h-3.5 ${walletRefreshing ? "animate-spin" : ""}`}
                                />
                            </button>
                        </div>
                    )}

                    {sessionUser && (
                        <span className="hidden md:inline text-sm text-neutral-600 truncate max-w-[140px]">
                            {displayName}
                        </span>
                    )}

                    <Button
                        icon={<UserIcon />}
                        size="icon"
                        onClick={() => setShowMenu((prev) => !prev)}
                        variant="ghost"
                    />
                </div>

                {showMenu && (
                    <div className="absolute top-12 right-0 z-50 min-w-[220px] rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
                        {sessionUser && (
                            <Link
                                to="/configuracao/usage"
                                className="flex md:hidden items-center gap-2 px-4 py-2.5 text-sm text-amber-950 bg-amber-50/80 hover:bg-amber-100/80 border-b border-amber-100"
                                onClick={() => setShowMenu(false)}
                            >
                                <Zap className="w-4 h-4 text-amber-600" />
                                {creditsRemainingLabel(walletBalance)}
                            </Link>
                        )}
                        <Link
                            to="/configuracao"
                            className="flex items-center gap-2 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50"
                            onClick={() => setShowMenu(false)}
                        >
                            <Settings className="w-4 h-4 text-neutral-500" />
                            Configuração
                        </Link>
                        <button
                            type="button"
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 text-left"
                            onClick={() => {
                                setShowMenu(false)
                                try {
                                    window.localStorage.removeItem(
                                        "teachai:user"
                                    )
                                } catch {
                                    /* ignore */
                                }
                                setSessionUser(null)
                                navigate("/")
                            }}
                        >
                            <LogOutIcon className="w-4 h-4 text-neutral-500" />
                            Sair
                        </button>
                    </div>
                )}
            </div>
        </header>
    )
}
