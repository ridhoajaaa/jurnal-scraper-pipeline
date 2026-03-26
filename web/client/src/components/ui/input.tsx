import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-[#6b7280] selection:bg-indigo-500/30 selection:text-white",
        "border-[#374151] bg-[#0d111f] h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-xs transition-all outline-none",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 aria-invalid:border-red-500",
        className
      )}
      {...props}
    />
  )
}

export { Input }
