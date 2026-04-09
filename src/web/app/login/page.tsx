"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { GradientBackground } from "@/components/gradient-background";
import { sendCode, verifyCode, listWorkspaces } from "@/lib/api";
import { ApiError } from "@/lib/errors";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await sendCode(email);
      setStep("code");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isRateLimit) {
          setError("Please wait before requesting another code");
        } else if (err.isNetworkError) {
          setError("Unable to connect — check your network");
        } else {
          setError(err.message);
        }
      } else {
        setError(err instanceof Error ? err.message : "Failed to send code");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (value: string) => {
    setCode(value);
    if (value.length !== 6) return;

    setError("");
    setLoading(true);
    try {
      const res = await verifyCode(email, value);
      localStorage.setItem("alook_token", res.token);

      try {
        const workspaces = await listWorkspaces();
        if (workspaces.length > 0) {
          localStorage.setItem("alook_workspace_id", workspaces[0].id);
        }
      } catch {
        setError("Signed in, but failed to load workspace");
      }

      router.push("/agents");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isRateLimit) {
          setError("Please wait before requesting another code");
        } else if (err.isNetworkError) {
          setError("Unable to connect — check your network");
        } else {
          setError(err.message);
        }
      } else {
        setError(err instanceof Error ? err.message : "Invalid code");
      }
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative">
      <GradientBackground />
      <Card className="w-full max-w-sm bg-card/80 backdrop-blur-xl">
        <CardHeader className="text-center">
          <Logo size="lg" className="justify-center" />
          <CardDescription>
            {step === "email"
              ? "Sign in with your email"
              : "Enter the verification code"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "email" ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send Code"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                We sent a code to <strong>{email}</strong>
              </p>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={handleVerifyCode}
                  disabled={loading}
                  autoFocus
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError("");
                }}
              >
                Use a different email
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
