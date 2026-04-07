import { useEffect, useState } from "react"
import { Link, useNavigate, useOutletContext } from "react-router-dom"
import { Check, Rocket, Sparkles } from "lucide-react"
import { useBillingData } from "../../hooks/useBillingData"
import { getPlans } from "../../services/api"
import { formatBrlFromCents, formatDatePt } from "../../lib/creditUi"
import { buildPaymentLink } from "../../lib/stripePaymentLinks"

function CostBlock({ title, emoji, children }) {
    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                <span aria-hidden>{emoji}</span>
                {title}
            </h3>
            <ul className="space-y-2 text-sm text-neutral-600">{children}</ul>
        </div>
    )
}

const PLAN_BULLETS = {
    free: ["Upload de PDF", "Áudio (TTS)", "Quiz e Flashcards"],
    pro: ["Tudo do Free", "Mais PDFs e áudios", "Prioridade na IA"],
    plus: ["Tudo do Pro", "Volume ampliado"],
    ultra: ["Tudo do Plus", "Topo de créditos mensais"],
}

function defaultBullets(slug) {
    return PLAN_BULLETS[slug] || ["Créditos mensais", "PDF, TTS e IA"]
}

function planTitle(slug, name) {
    if (slug === "free") return <>🆓 {name}</>
    if (slug === "plus") return <>💎 {name}</>
    if (slug === "ultra")
        return (
            <>
                {name}{" "}
                <Sparkles className="inline w-4 h-4 text-amber-600 align-[-2px]" />
            </>
        )
    if (slug === "pro")
        return (
            <>
                {name}{" "}
                <Rocket className="inline w-4 h-4 text-violet-600 align-[-2px]" />
            </>
        )
    return name
}

function planCardClass(slug, isCurrent) {
    const base =
        "rounded-2xl p-5 flex flex-col border transition-shadow"
    if (isCurrent) {
        return `${base} border-2 border-neutral-900 bg-white shadow-md`
    }
    if (slug === "pro") {
        return `${base} border-violet-200 bg-linear-to-b from-violet-50/80 to-white shadow-sm ring-1 ring-violet-100`
    }
    if (slug === "plus") {
        return `${base} border-teal-200 bg-linear-to-b from-teal-50/50 to-white shadow-sm`
    }
    if (slug === "ultra") {
        return `${base} border-amber-200 bg-linear-to-b from-amber-50/40 to-white shadow-sm`
    }
    return `${base} border-neutral-200 bg-white shadow-sm`
}

function checkClass(slug) {
    if (slug === "pro") return "text-violet-600"
    if (slug === "plus") return "text-teal-600"
    if (slug === "ultra") return "text-amber-600"
    return "text-emerald-600"
}

export default function OverviewPage() {
    const navigate = useNavigate()
    const { user } = useOutletContext()
    const userId = user?.id != null ? String(user.id).trim() : ""
    const { summary, loading: summaryLoading, error } = useBillingData(userId)

    const [plans, setPlans] = useState([])
    const [plansLoading, setPlansLoading] = useState(true)
    const [plansError, setPlansError] = useState(null)

    useEffect(() => {
        let cancelled = false
        setPlansLoading(true)
        setPlansError(null)
        getPlans()
            .then((data) => {
                if (cancelled) return
                setPlans(Array.isArray(data?.plans) ? data.plans : [])
            })
            .catch((e) => {
                if (cancelled) return
                setPlansError(
                    e?.response?.data?.message ||
                        e?.message ||
                        "Não foi possível carregar os planos."
                )
                setPlans([])
            })
            .finally(() => {
                if (!cancelled) setPlansLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [])

    const currentSlug = summary?.subscription?.plan?.slug ?? null
    const planLabel =
        summary?.subscription?.plan?.name ?? "Sem assinatura ativa"
    const remaining = summary?.usage?.remaining ?? 0
    const planLimit = summary?.usage?.planMonthlyCredits
    const renewLabel = summary?.subscription?.currentPeriodEnd
        ? formatDatePt(summary.subscription.currentPeriodEnd)
        : "—"

    const creditUnitCents = summary?.billingConfig?.creditUnitCents ?? 10
    const proPlan = plans.find((p) => p.slug === "pro")

    const loading = summaryLoading && userId
    const showSummaryBlock = Boolean(userId)

    return (
        <div className="max-w-5xl space-y-10">
            <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-600 mb-1">
                    TeachAI Credits
                </p>
                <h1 className="text-2xl font-light text-neutral-900">Planos</h1>
                <p className="text-sm text-neutral-500 mt-1">
                    Créditos unificam PDF, áudio (TTS) e recursos de IA. Dados do
                    servidor.
                </p>
            </div>

            {error && (
                <p className="text-sm text-red-600 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                    {error}
                </p>
            )}
            {plansError && (
                <p className="text-sm text-amber-800 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                    {plansError}
                </p>
            )}

            <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                    <span aria-hidden>💰</span> Valor do crédito
                </h2>
                <p className="text-xs text-neutral-500 mb-4">
                    Referência comercial por crédito (BillingConfig no servidor).
                </p>
                <div className="overflow-x-auto rounded-lg border border-neutral-100">
                    <table className="w-full text-sm text-left min-w-[280px]">
                        <thead>
                            <tr className="bg-neutral-50 border-b border-neutral-100">
                                <th className="px-4 py-2.5 font-medium text-neutral-600">
                                    Contexto
                                </th>
                                <th className="px-4 py-2.5 font-medium text-neutral-600">
                                    Valor por crédito
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="px-4 py-2.5 text-neutral-800">
                                    Planos (assinatura)
                                </td>
                                <td className="px-4 py-2.5 text-neutral-700 tabular-nums">
                                    {userId && summary
                                        ? formatBrlFromCents(creditUnitCents)
                                        : formatBrlFromCents(10)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                {!userId && (
                    <p className="text-xs text-neutral-500 mt-2">
                        Faça login para ver o valor alinhado à sua conta.
                    </p>
                )}
            </section>

            {showSummaryBlock && (
                <section className="rounded-2xl border border-neutral-200 bg-linear-to-br from-white to-neutral-50/80 p-6 shadow-sm">
                    <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
                        Plano atual
                    </h2>
                    {loading && !summary ? (
                        <p className="text-sm text-neutral-500">
                            Carregando…
                        </p>
                    ) : (
                        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                            <div>
                                <p className="text-2xl font-medium text-neutral-900">
                                    {planLabel}
                                </p>
                                <p className="mt-2 flex items-center gap-2 text-sm text-neutral-700">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-950 px-2.5 py-0.5 text-xs font-semibold tabular-nums">
                                        ⚡{" "}
                                        {planLimit != null
                                            ? `${remaining} / ${planLimit} créditos restantes`
                                            : `${remaining} créditos`}
                                    </span>
                                </p>
                                <p className="text-xs text-neutral-500 mt-2">
                                    Renova em:{" "}
                                    <span className="text-neutral-700">
                                        {renewLabel}
                                    </span>
                                </p>
                            </div>
                            <Link
                                to="/configuracao/billing"
                                className="inline-flex justify-center rounded-xl bg-neutral-900 text-white text-sm font-medium px-5 py-2.5 hover:bg-neutral-800 transition-colors"
                            >
                                Ver cobrança
                            </Link>
                        </div>
                    )}
                </section>
            )}

            <div className="h-px bg-neutral-200" />

            <section>
                <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span aria-hidden>📦</span> Planos mensais
                </h2>
                {plansLoading ? (
                    <p className="text-sm text-neutral-500">
                        Carregando planos…
                    </p>
                ) : plans.length === 0 ? (
                    <p className="text-sm text-neutral-500">
                        Nenhum plano ativo no catálogo. Rode o seed de créditos no
                        servidor.
                    </p>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {plans.map((plan) => {
                            const slug = plan.slug || ""
                            const isCurrent =
                                currentSlug != null &&
                                String(currentSlug) === String(slug)
                            const bullets = defaultBullets(slug)
                            const chk = checkClass(slug)
                            return (
                                <article
                                    key={plan.id || slug}
                                    className={planCardClass(slug, isCurrent)}
                                >
                                    <div className="flex items-center justify-between mb-2 gap-2">
                                        <span className="text-base font-semibold">
                                            {planTitle(slug, plan.name)}
                                        </span>
                                        {isCurrent && (
                                            <span className="text-[10px] font-bold uppercase bg-neutral-900 text-white px-2 py-0.5 rounded shrink-0">
                                                Atual
                                            </span>
                                        )}
                                        {!isCurrent && slug === "pro" && (
                                            <span className="text-[10px] font-semibold uppercase text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded shrink-0">
                                                Recomendado
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xl font-semibold text-neutral-900">
                                        {formatBrlFromCents(
                                            plan.priceMonthlyCents ?? 0
                                        )}{" "}
                                        {Number(plan.priceMonthlyCents) > 0 && (
                                            <span className="text-sm font-normal text-neutral-500">
                                                / mês
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-2xl font-light text-neutral-900 mt-2 tabular-nums">
                                        {plan.monthlyCredits ?? 0}
                                        <span className="text-sm text-neutral-500 font-normal">
                                            {" "}
                                            créditos / mês
                                        </span>
                                    </p>
                                    {slug === "free" && (
                                        <p className="text-xs text-neutral-500 mt-2">
                                            Ideal para teste rápido.
                                        </p>
                                    )}
                                    {slug === "ultra" && (
                                        <p className="text-xs text-neutral-500 mt-2">
                                            Melhor custo para uso intenso.
                                        </p>
                                    )}
                                    <ul className="mt-4 space-y-2 text-sm text-neutral-700 flex-1">
                                        {bullets.map((t) => (
                                            <li key={t} className="flex gap-2">
                                                <Check
                                                    className={`w-4 h-4 shrink-0 mt-0.5 ${chk}`}
                                                />
                                                {t}
                                            </li>
                                        ))}
                                    </ul>
                                    <button
                                        type="button"
                                        disabled={isCurrent || slug === "free"}
                                        title={
                                            isCurrent || slug === "free"
                                                ? undefined
                                                : "Ir para pagamento"
                                        }
                                        onClick={() => {
                                            if (isCurrent || slug === "free") return
                                            const url = buildPaymentLink(slug, {
                                                email: user?.email,
                                            })
                                            if (url) {
                                                window.location.assign(url)
                                                return
                                            }
                                            navigate("/configuracao/checkout", {
                                                state: { plan },
                                            })
                                        }}
                                        className={
                                            isCurrent || slug === "free"
                                                ? "mt-5 w-full rounded-xl border border-neutral-200 bg-neutral-100 text-neutral-500 text-sm font-medium py-2.5 cursor-not-allowed"
                                                : slug === "pro"
                                                  ? "mt-5 w-full rounded-xl bg-violet-600 text-white text-sm font-semibold py-2.5 hover:bg-violet-700 transition-colors"
                                                  : slug === "plus"
                                                    ? "mt-5 w-full rounded-xl border border-teal-300 bg-white text-teal-900 text-sm font-semibold py-2.5 hover:bg-teal-50/80 transition-colors"
                                                    : slug === "ultra"
                                                      ? "mt-5 w-full rounded-xl border border-amber-300 bg-white text-amber-950 text-sm font-semibold py-2.5 hover:bg-amber-50/80 transition-colors"
                                                      : "mt-5 w-full rounded-xl border border-neutral-200 bg-white text-sm font-semibold py-2.5 hover:bg-neutral-50 transition-colors"
                                        }
                                    >
                                        {isCurrent
                                            ? "Plano ativo"
                                            : slug === "free"
                                              ? "Gratuito"
                                              : `Assinar ${plan.name}`}
                                    </button>
                                </article>
                            )
                        })}
                    </div>
                )}
            </section>

            <p className="text-xs text-neutral-500 mt-2">
                Nos cards acima: créditos por mês vêm do banco; o valor por
                crédito está na tabela acima.
            </p>

            <section>
                <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
                    💸 Custos das ações
                </h2>
                <p className="text-xs text-neutral-500 mb-3">
                    Mesma regra do servidor (preços em créditos, não em R$).
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                    <CostBlock title="Upload PDF" emoji="📄">
                        <li>Até 30 pág. → 2 créditos</li>
                        <li>31–80 pág. → 4 créditos</li>
                        <li>81–150 pág. → 6 créditos</li>
                    </CostBlock>
                    <CostBlock title="Áudio (TTS)" emoji="🔊">
                        <li>
                            1 crédito a cada 10 min de duração do MP3 gerado
                            (≤10 min = 1; ≤20 min = 2; etc.)
                        </li>
                        <li>
                            Se não der para ler a duração do arquivo, usa
                            estimativa por tamanho do texto.
                        </li>
                        <li>Mínimo 1 crédito por geração</li>
                    </CostBlock>
                    <CostBlock title="IA" emoji="🧠">
                        <li>Resumo → 1 crédito</li>
                        <li>Quiz → 1 crédito</li>
                        <li>Flashcards → 1 crédito</li>
                        <li>Anotações → 1 crédito</li>
                    </CostBlock>
                </div>
            </section>

            {proPlan && (
                <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-6">
                    <h2 className="text-sm font-semibold text-violet-950 mb-1">
                        Upgrade para {proPlan.name}{" "}
                        <Rocket className="inline w-4 h-4 text-violet-600 align-[-2px]" />
                    </h2>
                    <p className="text-sm text-violet-900/80">
                        {formatBrlFromCents(proPlan.priceMonthlyCents ?? 0)} / mês
                        · {proPlan.monthlyCredits ?? 0} créditos / mês.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                        <button
                            type="button"
                            onClick={() =>
                                navigate("/configuracao/checkout", {
                                    state: { plan: proPlan },
                                })
                            }
                            className="inline-flex rounded-lg bg-violet-600 text-white text-sm font-medium px-4 py-2 hover:bg-violet-700"
                        >
                            Assinar Pro
                        </button>
                        <Link
                            to="/configuracao/billing"
                            className="inline-flex rounded-lg border border-violet-200 bg-white text-violet-900 text-sm font-medium px-4 py-2 hover:bg-violet-50"
                        >
                            Cobrança
                        </Link>
                    </div>
                </section>
            )}
        </div>
    )
}
