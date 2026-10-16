"use client"

import {
  CircleCheck,
  Info,
  LoaderCircle,
  OctagonX,
  TriangleAlert,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ position = "top-right", ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position={position}
      icons={{
        success: <CircleCheck className="h-4 w-4 text-white" />,
        info: <Info className="h-4 w-4" />,
        warning: <TriangleAlert className="h-4 w-4" />,
        error: <OctagonX className="h-4 w-4 text-white" />,
        loading: <LoaderCircle className="h-4 w-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:data-[type=error]:!bg-red-600 group-[.toaster]:data-[type=error]:!text-white group-[.toaster]:data-[type=error]:!border-red-600 group-[.toaster]:data-[type=error]:shadow-md dark:group-[.toaster]:data-[type=error]:!bg-red-700 dark:group-[.toaster]:data-[type=error]:!border-red-600 group-[.toaster]:data-[type=success]:!bg-emerald-600 group-[.toaster]:data-[type=success]:!text-white group-[.toaster]:data-[type=success]:!border-emerald-600 group-[.toaster]:data-[type=success]:shadow-md dark:group-[.toaster]:data-[type=success]:!bg-emerald-700 dark:group-[.toaster]:data-[type=success]:!border-emerald-600",
          description:
            "group-[.toast]:text-muted-foreground group-[.toast]:data-[type=error]:!text-white/90 group-[.toast]:data-[type=success]:!text-white/90",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          error:
            "!bg-red-600 !text-white !border-red-600 shadow-md dark:!bg-red-700 dark:!border-red-600 [&_[data-description]]:!text-white/90 [&_[data-icon]]:!text-white [&_[data-close-button]]:!text-white",
          success:
            "!bg-emerald-600 !text-white !border-emerald-600 shadow-md dark:!bg-emerald-700 dark:!border-emerald-600 [&_[data-description]]:!text-white/90 [&_[data-icon]]:!text-white [&_[data-close-button]]:!text-white",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
