"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AbasCopa() {
  const caminho = usePathname() || "";
  const naGaleria = caminho.startsWith("/copa/titulos");
  return (
    <nav className="tabsbar copa-tabsbar">
      <div className="wrap">
        <Link href="/copa" className="tab" aria-current={!naGaleria ? "page" : undefined}>Edições</Link>
        <Link href="/copa/titulos" className="tab" aria-current={naGaleria ? "page" : undefined}>Títulos</Link>
      </div>
    </nav>
  );
}
