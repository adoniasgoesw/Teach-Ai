export default function Button({
    icon,
    text,
    variant = "primary",
    size = "md",
    onClick,
    ...rest
}) {
    const baseClassName =
        "inline-flex items-center justify-center gap-2 font-medium rounded-full " +
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-black/50 " +
        "disabled:opacity-50 disabled:cursor-not-allowed transition-transform duration-150 active:scale-95";

    const variantClassName = {
        primary: "",
        secondary: "",
        tertiary: "",
        outline: "border border-gray-300  text-gray-600 w-full",
        dropdown: "flex justify-start  w-full text-gray-600 font-light hover:bg-gray-200",
        ghost: "",
        logout: "",
        icon: "",
    }[variant] || "";

    const sizeClassName = {
        sm: "px-3 py-2 text-xs md:text-sm w-full",
        md: "px-4 py-2 text-sm md:text-base",
        lg: "px-5 py-3 text-base md:text-lg",
        icon: "p-2",
    }[size] || "";

    return (
        <button
            type="button"
            onClick={onClick}
            data-variant={variant}
            data-size={size}
            className={`${baseClassName} ${variantClassName} ${sizeClassName}`.trim()}
            {...rest}
        >
            {icon}
            {text}
        </button>
    )
}