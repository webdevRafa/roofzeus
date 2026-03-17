import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={[
        "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold",
        "ring-1 ring-[rgb(var(--color-border-rgb)/0.14)]",
        "bg-[rgb(var(--color-surface-rgb)/0.45)] hover:bg-[rgb(var(--color-surface-rgb)/0.65)]",
        "text-[rgb(var(--color-text-rgb)/0.90)]",
        "backdrop-blur-md hover:shadow-md",
      ].join(" ")}
      aria-label="Toggle theme"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
