"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2, User, Building2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { updateProfile } from "./actions";

// ─── Submit button ─────────────────────────────────────────────────────────────

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="bg-[#1a1a2e] text-white hover:bg-[#1a1a2e]/90"
    >
      {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      Save Changes
    </Button>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [state, formAction] = useActionState(updateProfile, {});

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your profile and account preferences
        </p>
      </div>

      {/* Success banner */}
      {state.success && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          Your profile has been updated successfully.
        </div>
      )}

      {/* Error banner */}
      {state.error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {/* Profile card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Profile</CardTitle>
          </div>
          <CardDescription>
            Update your display name and professional details.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form action={formAction} className="space-y-5">
            {/* Full name */}
            <div className="space-y-1.5">
              <Label htmlFor="full_name">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="full_name"
                name="full_name"
                placeholder="Jane Smith"
                defaultValue={state.fields?.full_name}
                required
              />
            </div>

            {/* Firm name */}
            <div className="space-y-1.5">
              <Label htmlFor="firm_name">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  Firm Name
                </span>
              </Label>
              <Input
                id="firm_name"
                name="firm_name"
                placeholder="Smith Advisory Group"
                defaultValue={state.fields?.firm_name}
              />
              <p className="text-xs text-muted-foreground">
                Your advisory firm or company name. Shown on board decks.
              </p>
            </div>

            <SubmitButton />
          </form>
        </CardContent>
      </Card>

      {/* Account info card (read-only) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Account</CardTitle>
          </div>
          <CardDescription>
            Your account email and authentication settings.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email Address</Label>
            <p className="text-sm text-muted-foreground">
              Email changes are handled through your authentication provider.
              Contact support if you need to update your email.
            </p>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <p className="text-sm font-medium">Password</p>
            <p className="text-xs text-muted-foreground">
              If you signed up with email and password, you can reset your
              password from the login page.
            </p>
            <Link href="/login">
              <Button variant="outline" size="sm">
                Go to Login Page
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">
            Danger Zone
          </CardTitle>
          <CardDescription>
            These actions are irreversible. Please proceed with caution.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-4">
            <div>
              <p className="text-sm font-medium">Delete Account</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permanently remove your account and all associated data.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled
              title="Contact support to delete your account"
            >
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
