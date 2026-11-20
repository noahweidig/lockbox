import Link from "next/link";
import { LockKeyhole } from "lucide-react";

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="LockBox home">
      <span className="logo-mark">
        <LockKeyhole size={18} strokeWidth={2.5} />
      </span>
      <span>LockBox</span>
    </Link>
  );
}
