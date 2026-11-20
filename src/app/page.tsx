import Link from "next/link";
import { ArrowRight, Ban, GitFork, KeyRound, Lock, ShieldCheck, Snowflake, Timer, Vault } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getUser } from "@/lib/auth";

const features = [
  [Timer, "Time locks", "Pick 5 minutes to 365 days. Until the clock runs out, the server will not hand the secret over."],
  [ShieldCheck, "Encrypted at rest", "AES-256-GCM with a separate key per secret. The database only holds ciphertext."],
  [KeyRound, "Many secrets", "Keep a Screen Time passcode for each kid or device, plus passwords, PINs, and notes."],
  [Ban, "No early release", "Locks can be extended but never shortened from your account, and no one can read your secrets from the admin panel. You can still delete a secret to destroy it."],
  [Snowflake, "Cooling-off period", "Changing or resetting your password pauses reveals for 24 hours, so a reset can't skip the wait."],
  [GitFork, "Open source", "MIT licensed. Read it, audit it, host your own copy on Vercel with a Neon database."],
] as const;

const steps = [
  ["Set a random passcode", "Generate a code in LokBoks and enter it in iOS Screen Time, Android Digital Wellbeing, or any app."],
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
          <ThemeToggle />
          {user ? (
            <Link href="/vault" className="btn btn-primary"><Vault size={16} /> Open vault</Link>
          ) : (
            <>
              <Link href="/login">Sign in</Link>
              <Link href="/register" className="btn btn-primary">Get started</Link>
            </>
          )}
        </nav>
      </header>

      <section className="hero">
        <div className="eyebrow"><i /> Open source · AES-256 encrypted</div>
        <h1>
          Lock your passcodes
          <br />
          <span>until you&apos;re ready.</span>
        </h1>
        <p>
          LokBoks keeps your Screen Time passcode and other secrets behind a time lock that you can&apos;t talk yourself out of.
        </p>
        <div className="row">
          <Link href={user ? "/vault/new" : "/register"} className="btn btn-primary btn-lg"><Lock size={18} /> Lock a passcode</Link>
          <a href="#how" className="btn btn-lg">How it works <ArrowRight size={18} /></a>
        </div>
        <div className="showcase" aria-hidden="true">
          <div className="card">
            <div className="top">
              <div><b>Screen Time · Maya</b><small>Locked secret</small></div>
              <span className="badge badge-locked"><Lock size={14} /> 4d 06h</span>
            </div>
            <div className="bar"><i /></div>
            <div className="top"><small>Unlocks Sunday 9:00 AM</small><small className="mono">••••••</small></div>
          </div>
        </div>
      </section>

      <div className="proof">
        <div><b>5 min</b><span>shortest lock</span></div>
        <div><b>365 d</b><span>longest lock</span></div>
        <div><b>24 h</b><span>reset cooldown</span></div>
      </div>

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

      <section className="section">
        <div className="card cta">
          <h2>Hand your future self a timer.</h2>
          <p>Free, open source, and set up in under a minute.</p>
          <Link href={user ? "/vault/new" : "/register"} className="btn btn-primary btn-lg"><Lock size={18} /> Lock a passcode</Link>
        </div>
      </section>

      <footer className="footer">LokBoks is open source under the MIT license.</footer>
    </div>
  );
}
