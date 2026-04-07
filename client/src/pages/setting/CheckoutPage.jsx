import { useEffect, useMemo, useState } from "react"
import {
    Link,
    useLocation,
    useNavigate,
    useOutletContext,
    useSearchParams,
} from "react-router-dom"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { ArrowLeft, Check, Lock, ShieldCheck } from "lucide-react"
import Button from "../../components/buttons/Button"
import { createStripeSubscription, getPlans } from "../../services/api"
import { formatBrlFromCents } from "../../lib/creditUi"
import { getStripe, hasStripePublishableKey } from "../../lib/stripeClient"
import { notifyCreditsUpdated } from "../../lib/creditsEvents"

const PLAN_BULLETS = {
    pro: ["Tudo do Free", "Mais PDFs e áudios", "Prioridade na IA"],
    plus: ["Tudo do Pro", "Volume ampliado"],
    ultra: ["Tudo do Plus", "Topo de créditos mensais"],
}

function bulletsForSlug(slug) {
    return PLAN_BULLETS[slug] || ["Créditos mensais", "PDF, TTS e recursos de IA"]
}

const elementsAppearance = {
    theme: "stripe",
    variables: {
        borderRadius: "12px",
        colorPrimary: "#171717",
    },
}

function CheckoutPayForm({ planName, fullName, email }) {
    const stripe = useStripe()
    const elements = useElements()
    const navigate = useNavigate()
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState(null)

    async function handleSubmit(e) {
        e.preventDefault()
        if (!stripe || !elements) return
        setBusy(true)
        setErr(null)
        try {
            const { error } = await stripe.confirmPayment({
                elements,
                redirect: "if_required",
                confirmParams: {
                    return_url: `${window.location.origin}/configuracao/overview?checkout=success`,
                    billing_details: {
                        name: fullName.trim(),
                        email: email.trim(),
                    },
                },
            })
            if (error) {
                setErr(error.message || "Pagamento não concluído.")
                return
            }
            notifyCreditsUpdated()
            navigate("/configuracao/overview?checkout=success")
        } finally {
            setBusy(false)
        }
    }

    return (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <PaymentElement />
            {err && (
                <p className="text-sm text-red-600 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                    {err}
                </p>
            )}
            <Button
                type="submit"
                text={busy ? "Processando…" : `Pagar e assinar ${planName}`}
                disabled={busy || !fullName.trim() || !email.trim()}
                className="inline-flex items-center justify-center gap-2 font-semibold rounded-xl w-full py-3.5 text-sm bg-neutral-900 text-white hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-[0.99] border-0"
            />
        </form>
    )
}

export default function CheckoutPage() {
    const { user } = useOutletContext()
    const navigate = useNavigate()
    const location = useLocation()
    const [searchParams] = useSearchParams()
    const slugFromQuery = searchParams.get("plan")?.trim().toLowerCase() || ""

    const initialPlan = location.state?.plan ?? null
    const [plan, setPlan] = useState(initialPlan)
    const [loadError, setLoadError] = useState(null)
    const [resolving, setResolving] = useState(
        Boolean(slugFromQuery && !initialPlan)
    )
    const [stripeOk, setStripeOk] = useState(null)

    const [fullName, setFullName] = useState(
        [user?.name, user?.lastName].filter(Boolean).join(" ").trim() ||
            user?.name ||
            ""
    )
    const [email, setEmail] = useState(user?.email?.trim() || "")

    const [prepareLoading, setPrepareLoading] = useState(false)
    const [prepareError, setPrepareError] = useState(null)
    const [clientSecret, setClientSecret] = useState(null)
    const [noClientSecret, setNoClientSecret] = useState(false)

    const stripePromise = useMemo(() => getStripe(), [])

    useEffect(() => {
        if (plan || !slugFromQuery) return
        let cancelled = false
        setResolving(true)
        setLoadError(null)
        getPlans()
            .then((data) => {
                if (cancelled) return
                const list = Array.isArray(data?.plans) ? data.plans : []
                const found = list.find(
                    (p) => String(p.slug).toLowerCase() === slugFromQuery
                )
                if (found && String(found.slug).toLowerCase() !== "free") {
                    setPlan(found)
                } else {
                    setLoadError("Plano não encontrado ou indisponível para assinatura.")
                }
            })
            .catch((e) => {
                if (!cancelled) {
                    setLoadError(
                        e?.response?.data?.message ||
                            e?.message ||
                            "Não foi possível carregar o plano."
                    )
                }
            })
            .finally(() => {
                if (!cancelled) setResolving(false)
            })
        return () => {
            cancelled = true
        }
    }, [plan, slugFromQuery])

    useEffect(() => {
        if (!hasStripePublishableKey()) {
            setStripeOk(null)
            return
        }
        let cancelled = false
        getStripe()
            ?.then((s) => {
                if (!cancelled) setStripeOk(Boolean(s))
            })
            .catch(() => {
                if (!cancelled) setStripeOk(false)
            })
        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        if (!plan?.id || !user?.id) return
        let cancelled = false
        setPrepareLoading(true)
        setPrepareError(null)
        setClientSecret(null)
        setNoClientSecret(false)
        createStripeSubscription(user.id, plan.id)
            .then((data) => {
                if (cancelled) return
                if (data?.clientSecret) {
                    setClientSecret(data.clientSecret)
                } else {
                    setNoClientSecret(true)
                }
            })
            .catch((e) => {
                if (!cancelled) {
                    setPrepareError(
                        e?.response?.data?.message ||
                            e?.message ||
                            "Não foi possível iniciar o pagamento."
                    )
                }
            })
            .finally(() => {
                if (!cancelled) setPrepareLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [plan?.id, user?.id])

    const slug = plan?.slug ? String(plan.slug).toLowerCase() : ""
    const isValidPaid = plan && slug && slug !== "free"

    const bullets = useMemo(() => bulletsForSlug(slug), [slug])

    const noPlanContext =
        !initialPlan && !slugFromQuery && !plan && !resolving && !loadError

    if (resolving) {
        return (
            <div className="max-w-lg space-y-4">
                <Link
                    to="/configuracao/overview"
                    className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar aos planos
                </Link>
                <p className="text-sm text-neutral-500">Carregando plano…</p>
            </div>
        )
    }

    if (loadError && !plan) {
        return (
            <div className="max-w-lg space-y-4">
                <Link
                    to="/configuracao/overview"
                    className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar aos planos
                </Link>
                <p className="text-sm text-red-600 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                    {loadError}
                </p>
            </div>
        )
    }

    if (noPlanContext) {
        return (
            <div className="max-w-lg space-y-4">
                <Link
                    to="/configuracao/overview"
                    className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar aos planos
                </Link>
                <p className="text-sm text-neutral-600">
                    Nenhum plano selecionado. Escolha um plano na página anterior.
                </p>
            </div>
        )
    }

    if (!isValidPaid) {
        return (
            <div className="max-w-lg space-y-4">
                <Link
                    to="/configuracao/overview"
                    className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar aos planos
                </Link>
                <p className="text-sm text-neutral-600">
                    Escolha um plano pago (Pro, Plus ou Ultra) para continuar.
                </p>
            </div>
        )
    }

    const price = plan.priceMonthlyCents ?? 0
    const credits = plan.monthlyCredits ?? 0

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900"
            >
                <ArrowLeft className="w-4 h-4" />
                Voltar
            </button>

            <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-600 mb-1">
                    Checkout
                </p>
                <h1 className="text-2xl font-light text-neutral-900">
                    Assinar {plan.name}
                </h1>
                <p className="text-sm text-neutral-500 mt-1">
                    Preencha nome e e-mail, depois os dados do cartão no campo
                    seguro da Stripe.
                </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-2 lg:gap-10 items-start">
                <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-5">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-neutral-900">
                                {plan.name}
                            </h2>
                            <p className="text-sm text-neutral-500 mt-1">
                                Assinatura mensal · renovação automática
                            </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-neutral-100 text-neutral-700 text-xs font-medium px-2.5 py-1">
                            Mensal
                        </span>
                    </div>

                    <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-4">
                        <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                            Valor cobrado hoje
                        </p>
                        <p className="text-3xl font-semibold text-neutral-900 mt-1 tabular-nums">
                            {formatBrlFromCents(price)}
                            <span className="text-base font-normal text-neutral-500">
                                {" "}
                                / mês
                            </span>
                        </p>
                        <p className="text-sm text-neutral-600 mt-3">
                            <span className="font-semibold tabular-nums text-neutral-900">
                                {credits}
                            </span>{" "}
                            créditos por ciclo após confirmação do pagamento
                            (webhook).
                        </p>
                    </div>

                    <div>
                        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
                            Inclui
                        </p>
                        <ul className="space-y-2.5">
                            {bullets.map((t) => (
                                <li
                                    key={t}
                                    className="flex gap-2 text-sm text-neutral-700"
                                >
                                    <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                                    {t}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <p className="text-xs text-neutral-400 flex items-start gap-2 pt-2 border-t border-neutral-100">
                        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                        Próxima cobrança e fim do período aparecem no resumo da
                        conta após o webhook processar o pagamento.
                    </p>
                </section>

                <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-5">
                    <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-neutral-500" />
                        Dados e pagamento
                    </h2>

                    {!hasStripePublishableKey() && (
                        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                            Defina{" "}
                            <code className="text-[11px] bg-amber-100/80 px-1 rounded">
                                VITE_STRIPE_PUBLISHABLE_KEY
                            </code>{" "}
                            no <code className="text-[11px]">client/.env.local</code>
                            .
                        </p>
                    )}

                    {hasStripePublishableKey() && stripeOk === false && (
                        <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                            Chave pública Stripe inválida ou bloqueada para este
                            domínio.
                        </p>
                    )}

                    <div className="space-y-4">
                        <label className="block">
                            <span className="text-xs font-medium text-neutral-600">
                                Nome completo
                            </span>
                            <input
                                type="text"
                                autoComplete="name"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/15 focus:border-neutral-300"
                                placeholder="Como no cartão"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-medium text-neutral-600">
                                E-mail
                            </span>
                            <input
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/15 focus:border-neutral-300"
                                placeholder="para recibo"
                            />
                        </label>
                    </div>

                    <div>
                        <span className="text-xs font-medium text-neutral-600 block mb-2">
                            Cartão
                        </span>
                        {prepareLoading && (
                            <p className="text-sm text-neutral-500 py-6">
                                Preparando formulário de pagamento…
                            </p>
                        )}
                        {prepareError && (
                            <p className="text-sm text-red-600 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                                {prepareError}
                            </p>
                        )}
                        {noClientSecret && !prepareLoading && !prepareError && (
                            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-700 space-y-2">
                                <p>
                                    Nenhum pagamento pendente retornado pela API
                                    (valor zero ou fluxo alternativo). Verifique o
                                    painel Stripe ou tente de novo em instantes.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => navigate("/configuracao/overview")}
                                    className="text-violet-700 font-medium hover:underline"
                                >
                                    Voltar aos planos
                                </button>
                            </div>
                        )}
                        {clientSecret && stripePromise && (
                            <Elements
                                key={clientSecret}
                                stripe={stripePromise}
                                options={{
                                    clientSecret,
                                    appearance: elementsAppearance,
                                }}
                            >
                                <CheckoutPayForm
                                    planName={plan.name}
                                    fullName={fullName}
                                    email={email}
                                />
                            </Elements>
                        )}
                    </div>

                    <p className="text-[11px] text-neutral-400 text-center">
                        Cobrança recorrente até cancelar. Cartão salvo na Stripe
                        como método padrão da assinatura.
                    </p>
                </section>
            </div>
        </div>
    )
}
