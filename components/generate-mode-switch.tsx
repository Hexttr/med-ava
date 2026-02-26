"use client"

import { HelpCircle } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type GenerateMode = "all" | "medical" | "corporate"

interface GenerateModeSwitchProps {
  value: GenerateMode
  onChange: (value: GenerateMode) => void
  disabled?: boolean
}

export function GenerateModeSwitch({ value, onChange, disabled }: GenerateModeSwitchProps) {
  return (
    <div className="flex items-center gap-2">
      <fieldset className="generate-mode-switch border-0 p-0" aria-label="Режим генерации">
        <input
          id="mode-all"
          name="generate-mode"
          type="radio"
          checked={value === "all"}
          onChange={() => onChange("all")}
          disabled={disabled}
        />
        <label htmlFor="mode-all">Все</label>
        <input
          id="mode-medical"
          name="generate-mode"
          type="radio"
          checked={value === "medical"}
          onChange={() => onChange("medical")}
          disabled={disabled}
        />
        <label htmlFor="mode-medical">1</label>
        <input
          id="mode-corporate"
          name="generate-mode"
          type="radio"
          checked={value === "corporate"}
          onChange={() => onChange("corporate")}
          disabled={disabled}
        />
        <label htmlFor="mode-corporate">2</label>
      </fieldset>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              disabled && "pointer-events-none opacity-50"
            )}
            aria-label="Подсказка о режимах"
          >
            <HelpCircle className="size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 text-sm">
          <p className="font-medium">Режимы генерации</p>
          <ul className="mt-2 space-y-1.5 text-muted-foreground">
            <li>
              <strong className="text-foreground">Все</strong> — генерируются оба портрета (медицинский и корпоративный).
            </li>
            <li>
              <strong className="text-foreground">1</strong> — только медицинский портрет. Второй можно догенерировать вручную.
            </li>
            <li>
              <strong className="text-foreground">2</strong> — только корпоративный портрет. Второй можно догенерировать вручную.
            </li>
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  )
}
