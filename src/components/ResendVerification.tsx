"use client";

import { useActionState } from "react";
import { MailWarning } from "lucide-react";
import { resendVerification } from "@/app/actions/auth";

export function ResendVerification({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resendVerification, undefined);
  return (
    <form action={action} className="row">
      <MailWarning size={18} />
      <span style={{ flex: 1 }}>
        Confirm <b>{email}</b> so you can recover your account.
        {state?.ok && <> {state.ok}</>}
        {state?.error && <> {state.error}</>}
      </span>
      <button className="btn btn-ghost" disabled={pending}>Resend email</button>
    </form>
  );
}
