import Link from "next/link";
import { ArrowRight, Ban, GitFork, KeyRound, Lock, ShieldCheck, Snowflake, Timer } from "lucide-react";
import { Logo } from "@/components/Logo";
import { getUser } from "@/lib/auth";

const features = [
  [Timer, "Time locks", "Pick 5 minutes to 365 days. Until the clock runs out, the server will not hand the secret over."],
  [ShieldCheck, "Encrypted at rest", "AES-256-GCM with a separate key per secret. The database only holds ciphertext."],
  [KeyRound, "Many secrets", "Keep a Screen Time passcode for each kid or device, plus passwords, PINs, and notes."],
  [Ban, "No early release", "Locks can be extended but never shortened from your account, and no one can read your secrets from the admin panel."],
  [Snowflake, "Cooling-off period", "Changing or resetting your password pauses reveals for 24 hours, so a reset can't skip the wait."],
  [GitFork, "Open source", "MIT licensed. Read it, audit it, host your own copy on Vercel with a Neon database."],
] as const;

const steps = [
  ["Set a random passcode", "Generate a code in LockBox and enter it in iOS Screen Time, Android Digital Wellbeing, or any app."],
  ["Lock it away", "Choose how long. Paste, save, and forget the code."],
  ["Get it back later", "When the timer ends, confirm your password and reveal the code for 30 seconds."],
];

export default async function Home() {
  const user = await getUser().catch(() => null);
  return (
    <div className="wrap">
      <header className="nav">
        <Logo />
        <nav>
          {user ? (
            <Link href="/vault" className="btn btn-primary">Open vault</Link>
          ) : (
            <>
              <Link href="/login">Sign in</Link>
              <Link href="/register" className="btn btn-primary">Get started</Link>
            </>
          )}
        </nav>
      </header>

      <section className="hero">
        <h1>
          Lock your passcodes
          <br />
          <span>until you&apos;re ready.</span>
        </h1>
        <p>
          LockBox keeps your Screen Time passcode and other secrets behind a time lock that you can&apos;t talk yourself out of.
        </p>
        <div className="row">
          <Link href={user ? "/vault/new" : "/register"} className="btn btn-primary btn-lg"><Lock size={18} /> Lock a passcode</Link>
          <a href="#how" className="btn btn-lg">How it works <ArrowRight size={18} /></a>
        </div>
      </section>

      <section className="section grid">
        {features.map(([Icon, t, d]) => (
          <div key={t} className="card feature">
            <div className="ico"><Icon size={20} /></div>
            <h3>{t}</h3>
            <p>{d}</p>
          </div>
        ))}
      </section>

      <section id="how" className="section">
        <h2>How it works</h2>
        <div className="grid steps">
          {steps.map(([t, d]) => (
            <div key={t} className="card">
              <h3>{t}</h3>
              <p className="muted" style={{ margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="footer">LockBox is open source under the MIT license.</footer>
    </div>
  );
}
