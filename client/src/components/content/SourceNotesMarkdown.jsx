import ReactMarkdown from "react-markdown"

/**
 * Renderiza anotações geradas em Markdown (## títulos, **negrito**, listas, `código`).
 * Os símbolos ## * ` não aparecem na tela — viram tipografia estilizada.
 */
export default function SourceNotesMarkdown({ content }) {
    const text = String(content ?? "").trim()
    if (!text) return null

    return (
        <div className="rounded-2xl border border-gray-200/90 bg-linear-to-b from-white via-neutral-50/40 to-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-200/80 bg-white/80 px-5 py-4">
                <h2 className="text-lg font-semibold tracking-tight text-gray-900">
                    Anotações
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                    Resumo acadêmico do material — títulos e destaques automáticos
                </p>
            </div>
            <div className="px-5 py-5 max-w-none">
                <ReactMarkdown
                    components={{
                        h1: ({ children }) => (
                            <h3 className="text-xl font-bold text-gray-900 mt-6 mb-3 first:mt-0 tracking-tight">
                                {children}
                            </h3>
                        ),
                        h2: ({ children }) => (
                            <h3 className="text-lg font-semibold text-gray-900 mt-7 mb-2.5 first:mt-0 pb-2 border-b border-gray-200">
                                {children}
                            </h3>
                        ),
                        h3: ({ children }) => (
                            <h4 className="text-base font-semibold text-gray-800 mt-5 mb-2">
                                {children}
                            </h4>
                        ),
                        p: ({ children }) => (
                            <p className="text-[15px] leading-relaxed text-gray-700 my-2.5 first:mt-0 [&+ul]:mt-2 [&+ol]:mt-2">
                                {children}
                            </p>
                        ),
                        strong: ({ children }) => (
                            <strong className="font-semibold text-gray-900">
                                {children}
                            </strong>
                        ),
                        em: ({ children }) => (
                            <em className="italic text-gray-800">{children}</em>
                        ),
                        ul: ({ children }) => (
                            <ul className="my-3 space-y-2 pl-1 list-disc marker:text-gray-400 text-gray-700 ml-4">
                                {children}
                            </ul>
                        ),
                        ol: ({ children }) => (
                            <ol className="my-3 space-y-2 pl-1 list-decimal marker:font-medium marker:text-gray-500 text-gray-700 ml-4">
                                {children}
                            </ol>
                        ),
                        li: ({ children }) => (
                            <li className="text-[15px] leading-relaxed pl-1">
                                {children}
                            </li>
                        ),
                        hr: () => (
                            <hr className="my-6 border-0 border-t border-gray-200" />
                        ),
                        blockquote: ({ children }) => (
                            <blockquote className="my-3 border-l-4 border-violet-300/80 pl-4 py-0.5 text-gray-600 italic text-[15px] leading-relaxed bg-violet-50/50 rounded-r-lg">
                                {children}
                            </blockquote>
                        ),
                        pre: ({ children }) => (
                            <pre className="my-4 p-4 rounded-xl bg-slate-900 text-slate-100 text-sm overflow-x-auto border border-slate-700/80 shadow-inner">
                                {children}
                            </pre>
                        ),
                        code: ({ className, children, ...props }) => {
                            const isBlock = /language-[\w-]+/.test(
                                String(className || "")
                            )
                            if (isBlock) {
                                return (
                                    <code
                                        className={`${className ?? ""} text-[13px] leading-relaxed`}
                                        {...props}
                                    >
                                        {children}
                                    </code>
                                )
                            }
                            return (
                                <code
                                    className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[13px] font-mono text-gray-800 border border-gray-200/80"
                                    {...props}
                                >
                                    {children}
                                </code>
                            )
                        },
                    }}
                >
                    {text}
                </ReactMarkdown>
            </div>
        </div>
    )
}
