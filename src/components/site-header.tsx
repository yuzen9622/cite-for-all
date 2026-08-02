"use client"

import { ExternalLink } from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import Link from "next/link"
import { SignInDialog } from "@/components/auth/sign-in-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function SiteHeader() {
  const { data: session } = useSession()
  const user = session?.user

  return (
    <div className="mx-auto w-full max-w-[1480px] px-3 sm:px-7">
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border sm:min-h-[76px]">
        <Link
          href="/"
          className="flex shrink-0 items-baseline gap-2 font-heading text-xl font-bold tracking-[-0.04em]"
          aria-label="回到 Cite for All 首頁"
        >
          <span>CITE</span>
          <span className="font-mono text-accent">/</span>
          <span>ALL</span>
        </Link>
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <a
            href="https://citationstyles.org/"
            target="_blank"
            rel="noreferrer"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-muted-foreground"
            )}
          >
            <span className="size-2 rounded-full bg-[#5d9a56] shadow-[0_0_0_5px_rgb(93_154_86/0.12)]" />
            <span className="hidden md:inline">
              (c) Frank Bennett · citeproc-js implements the Citation Style
              Language
            </span>
            <span className="md:hidden">(c) Frank Bennett · CSL</span>
            <ExternalLink className="size-3.5" />
          </a>
          {user ? (
            <div className="flex items-center gap-2">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt={user.name ?? user.email ?? "使用者頭像"}
                  className="size-8 rounded-full border border-border object-cover"
                />
              ) : (
                <span className="grid size-8 place-items-center rounded-full border border-border bg-secondary text-xs font-bold">
                  {(user.name ?? user.email ?? "使").slice(0, 1).toUpperCase()}
                </span>
              )}
              <Link
                href="/projects"
                className="hidden text-sm font-semibold hover:text-accent sm:inline"
              >
                我的專案
              </Link>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void signOut({ callbackUrl: "/" })}
                className="rounded-none"
              >
                登出
              </Button>
            </div>
          ) : (
            <SignInDialog />
          )}
        </div>
      </header>
    </div>
  )
}
