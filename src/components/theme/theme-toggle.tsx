"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    // Il tema risolto è noto solo dopo l'hydration: prima di allora l'icona
    // resta neutra per evitare mismatch server/client.
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted) {
        return <Button variant="ghost" size="icon" aria-label="Cambia tema" disabled/>;
    }

    const isDark = resolvedTheme === "dark";

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={isDark ? "Passa al tema chiaro" : "Passa al tema scuro"}
            onClick={() => setTheme(isDark ? "light" : "dark")}
        >
            {isDark ? <Sun className="h-4 w-4"/> : <Moon className="h-4 w-4"/>}
        </Button>
    );
}
