"use client";

import { useActionState, useEffect, useRef } from "react";
import type { State } from "@/app/actions/auth";

type Props = {
  action: (prev: State, fd: FormData) => Promise<State>;
  submit: string;
  children: React.ReactNode;
  className?: string;
  buttonClass?: string;
  resetOnOk?: boolean;
};

export function ActionForm({ action, submit, children, className, buttonClass = "btn btn-primary", resetOnOk }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnOk) ref.current?.reset();
  }, [state, resetOnOk]);

  return (
    <form ref={ref} action={formAction} className={className ?? "stack"}>
      {children}
      {state?.error && <p className="msg msg-err" role="alert">{state.error}</p>}
      {state?.ok && <p className="msg msg-ok" role="status">{state.ok}</p>}
      <button className={buttonClass} disabled={pending}>
        {pending ? "Working…" : submit}
      </button>
    </form>
  );
}
