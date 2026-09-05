"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/ranking", label: "Ranking" },
  { href: "/rodadas", label: "Rodadas" },
  { href: "/elenco", label: "Elenco" },
  { href: "/loja", label: "Loja" },
];

export default function Abas({ admin }: { admin: boolean }) {
  const caminho = usePathname() || "";
  const itens = admin ? [...ABAS, { href: "/ajustes", label: "Ajustes" }] : ABAS;

  return (
    <nav className="tabsbar">
      <div className="wrap">
        {itens.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="tab"
            aria-current={caminho.startsWith(a.href) ? "page" : undefined}
          >
            {a.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
