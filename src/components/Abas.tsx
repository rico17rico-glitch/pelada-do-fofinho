"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/ranking", label: "Ranking" },
  { href: "/rodadas", label: "Rodadas" },
  { href: "/elenco", label: "Elenco" },
  { href: "/loja", label: "Loja" },
  { href: "/caixa", label: "Caixa" },
];

export default function Abas({ admin, meuId }: { admin: boolean; meuId?: string | null }) {
  const caminho = usePathname() || "";
  /* "Meu perfil" primeiro: é o que o jogador procura, e antes só dava para
     chegar lá clicando no próprio nome lá em cima, que ninguém achava. */
  const itens = [
    ...(meuId ? [{ href: `/jogador/${meuId}`, label: "Meu perfil" }] : []),
    ...ABAS,
    ...(admin ? [{ href: "/ajustes", label: "Ajustes" }] : []),
  ];

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
