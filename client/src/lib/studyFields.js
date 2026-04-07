/**
 * Campo de estudo do curso (valor persistido no servidor + rótulo na UI).
 */
export const STUDY_FIELD_OPTIONS = [
    { value: "programacao", label: "Programação" },
    { value: "matematica", label: "Matemática" },
    { value: "fisica", label: "Física" },
    { value: "quimica", label: "Química" },
    { value: "biologia", label: "Biologia" },
    { value: "medicina", label: "Medicina" },
    { value: "enfermagem", label: "Enfermagem" },
    { value: "direito", label: "Direito" },
    { value: "administracao", label: "Administração" },
    { value: "economia", label: "Economia" },
    { value: "historia", label: "História" },
    { value: "geografia", label: "Geografia" },
    { value: "portugues", label: "Português e literatura" },
    { value: "idiomas", label: "Idiomas" },
    { value: "educacao", label: "Educação e pedagogia" },
    { value: "engenharia", label: "Engenharia" },
    { value: "outros", label: "Outros" },
]

export function labelForStudyField(value) {
    const v = String(value ?? "").trim().toLowerCase()
    const found = STUDY_FIELD_OPTIONS.find((o) => o.value === v)
    return found?.label ?? (v ? v : "—")
}
