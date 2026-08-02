"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  DialogViewport,
} from "@/components/ui/dialog"

type AuthProvider = "google" | "github"

function providerLabel(provider: AuthProvider) {
  return provider === "google" ? "Google" : "GitHub"
}

function notConfiguredMessage(provider: AuthProvider) {
  return `${providerLabel(provider)} 登入尚未設定完成，請聯絡管理員。`
}

function signInErrorMessage(provider: AuthProvider, error?: string) {
  if (error === "OAuthAccountNotLinked") {
    return "此帳號已與其他登入方式綁定，請改用原本的登入方式。"
  }

  if (
    !error ||
    error === "Configuration" ||
    error === "OAuthSignin" ||
    error === "OAuthCallbackError"
  ) {
    return notConfiguredMessage(provider)
  }

  return `${providerLabel(provider)} 登入失敗，請稍後再試。`
}

function hasMissingClientId(url: string | null) {
  if (!url) {
    return false
  }

  try {
    const clientId = new URL(url).searchParams.get("client_id")
    return clientId === null || clientId === "" || clientId === "undefined"
  } catch {
    return false
  }
}

export function SignInDialog() {
  const [open, setOpen] = useState(false)
  const [pendingProvider, setPendingProvider] = useState<AuthProvider | null>(
    null
  )
  const [error, setError] = useState("")

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setError("")
      setPendingProvider(null)
    }
  }

  async function handleSignIn(provider: AuthProvider) {
    setError("")
    setPendingProvider(provider)

    try {
      const result = await signIn(provider, {
        callbackUrl: "/",
        redirect: false,
      })

      if (!result || !result.ok || result.error || hasMissingClientId(result.url)) {
        setError(signInErrorMessage(provider, result?.error))
        return
      }

      if (!result.url) {
        setError(signInErrorMessage(provider))
        return
      }

      window.location.assign(result.url)
    } catch {
      setError(signInErrorMessage(provider))
    } finally {
      setPendingProvider(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-none"
          />
        }
      >
        登入
      </DialogTrigger>
      <DialogPortal>
        <DialogBackdrop />
        <DialogViewport>
          <DialogPopup>
            <div className="border border-foreground/30 bg-secondary/40 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <DialogTitle>登入 Cite for All</DialogTitle>
                  <DialogDescription className="mt-1">
                    選擇你要使用的登入方式。
                  </DialogDescription>
                </div>
                <DialogClose
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-none"
                    />
                  }
                >
                  關閉
                </DialogClose>
              </div>

              <div className="mt-5 grid gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleSignIn("google")}
                  disabled={pendingProvider !== null}
                  className="w-full rounded-none border-foreground/30 bg-background"
                >
                  {pendingProvider === "google"
                    ? "正在連線 Google…"
                    : "使用 Google 登入"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleSignIn("github")}
                  disabled={pendingProvider !== null}
                  className="w-full rounded-none border-foreground/30 bg-background"
                >
                  {pendingProvider === "github"
                    ? "正在連線 GitHub…"
                    : "使用 GitHub 登入"}
                </Button>
              </div>

              {error && (
                <p
                  className="mt-4 text-sm font-semibold text-destructive"
                  role="alert"
                >
                  {error}
                </p>
              )}
            </div>
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  )
}
