import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-indigo-100/20 bg-white/20 px-2.5 py-1 text-base transition-all outline-none placeholder:text-indigo-900/30 focus-visible:border-indigo-400 focus-visible:ring-3 focus-visible:ring-indigo-400/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
