import {
    Navigate,
    NavLink,
    Outlet,
    useLocation,
    useNavigate,
} from "react-router-dom"
import Header from "../../components/layouts/Header"
import { UserRound, LayoutGrid, Activity, CreditCard } from "lucide-react"

const nav = [
    { to: "profile", label: "Perfil", sub: "Conta", icon: UserRound },
    { to: "overview", label: "Planos", sub: "TeachAI Credits", icon: LayoutGrid },
    { to: "usage", label: "Uso", sub: "Consumo", icon: Activity },
    { to: "billing", label: "Cobrança", sub: "Plano e pagamento", icon: CreditCard },
]

export default function SettingsLayout() {
    const location = useLocation()
    const navigate = useNavigate()
    const section =
        location.pathname.match(/\/configuracao\/([^/]+)\/?$/)?.[1] ||
        "overview"

    const storedUser =
        typeof window !== "undefined"
            ? (() => {
                  try {
                      const raw = window.localStorage.getItem("teachai:user")
                      return raw ? JSON.parse(raw) : null
                  } catch {
                      return null
                  }
              })()
            : null

    if (!storedUser) {
        return <Navigate to="/login" replace state={{ from: location }} />
    }

    return (
        <section className="min-h-screen flex flex-col bg-neutral-50">
            <div className="px-5 md:px-10 lg:px-20 py-6 border-b border-neutral-200/80 bg-white">
                <Header />
            </div>

            <div className="flex flex-1 min-h-0 px-5 md:px-10 lg:px-20 py-8 gap-10">
                <aside className="w-52 lg:w-56 shrink-0 hidden md:block">
                    <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mb-5">
                        Configuração
                    </p>
                    <nav className="flex flex-col gap-0.5">
                        {nav.map(({ to, label, sub, icon: Icon }) => (
                            <NavLink
                                key={to}
                                to={to}
                                className={({ isActive }) =>
                                    [
                                        "flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                                        isActive
                                            ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200/90"
                                            : "text-neutral-600 hover:bg-white/70 hover:text-neutral-900",
                                    ].join(" ")
                                }
                            >
                                <Icon className="w-[18px] h-[18px] shrink-0 mt-0.5 text-neutral-400" />
                                <span>
                                    <span className="block text-sm font-medium leading-tight">
                                        {label}
                                    </span>
                                    <span className="block text-[11px] text-neutral-400 font-normal mt-0.5">
                                        {sub}
                                    </span>
                                </span>
                            </NavLink>
                        ))}
                    </nav>
                </aside>

                <div className="md:hidden w-full mb-2">
                    <select
                        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm"
                        value={section === "invoices" ? "billing" : section}
                        onChange={(e) =>
                            navigate(`/configuracao/${e.target.value}`)
                        }
                    >
                        {nav.map(({ to, label }) => (
                            <option key={to} value={to}>
                                {label}
                            </option>
                        ))}
                    </select>
                </div>

                <main className="flex-1 min-w-0 pb-12">
                    <Outlet context={{ user: storedUser }} />
                </main>
            </div>
        </section>
    )
}
