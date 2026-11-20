import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GuidedEntry } from "@/components/GuidedEntry";

export const metadata = { title: "Guided Screen Time lock" };

export default function GuidedPage() {
  return (
    <div className="narrow" style={{ width: "min(560px, 100%)" }}>
      <Link href="/vault" className="back"><ArrowLeft size={16} /> Back to vault</Link>
      <div className="page-head"><h1>Guided Screen Time lock</h1></div>
      <GuidedEntry />
    </div>
  );
}
