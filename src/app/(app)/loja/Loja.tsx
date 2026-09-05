"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ATTRS, AttrKey, Config, Player, precoUpgrade } from "@/lib/domain";
import { comprarAtributo } from "@/lib/actions";
import { CardJogador, Toast, useToast } from "@/components/ui";

export default function Loja({
  jogador, cfg, admin,
}: { jogador: Player; cfg: Config; admin: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const { msg, avisar } = useToast();

  function comprar(k: AttrKey) {
    iniciar(async () => {
      const r = await comprarAtributo(jogador.id, k);
      if (!r.ok) return avisar(r.erro || "Não deu para comprar.");
      router.refresh();
      avisar(r.msg || "Comprado!");
    });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Loja</h1>
          <p>Troque pontos por critério. Cada ponto comprado sobe 0,25 no overall.</p>
        </div>
        <div className="grow" />
        <div className="card pad" style={{ textAlign: "right", boxShadow: "none" }}>
          <div className="eyebrow">Saldo de {jogador.nome}</div>
          <div className="coins" style={{ fontFamily: "var(--f-display)", fontSize: 30, lineHeight: 1 }}>
            {jogador.moedas}
          </div>
        </div>
        {admin ? <Link className="btn sm ghost" href="/loja">Trocar de jogador</Link> : null}
      </div>

      <div className="card pad" style={{ marginBottom: 14 }}>
        <CardJogador p={jogador} />
      </div>

      <div className="shopgrid">
        {ATTRS.map((a) => {
          const v = jogador[("atr_" + a.k) as "atr_fin"];
          const preco = precoUpgrade(v, cfg);
          const noMaximo = v >= 99;
          const temGrana = jogador.moedas >= preco;
          return (
            <div className="shopitem" key={a.k}>
              <div className="hd">
                <b>{a.nome}</b>
                <span className="cur">{v}</span>
              </div>
              <div className="bar" style={{ background: "var(--surface-2)" }}>
                <i style={{ width: v + "%" }} />
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="note">
                  {noMaximo ? "No máximo" : <>+1 ponto → <b className="coins">{preco} pts</b></>}
                </span>
                <button
                  className="btn sm primary"
                  disabled={noMaximo || !temGrana || pendente}
                  onClick={() => comprar(a.k)}
                >
                  Comprar
                </button>
              </div>
              {!temGrana && !noMaximo ? (
                <span className="note">Faltam {preco - jogador.moedas} pts.</span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="card pad" style={{ marginTop: 14 }}>
        <div className="sect-title" style={{ marginBottom: 8 }}>Preços</div>
        <div className="legend">
          {(cfg.faixas || []).map((f, i, arr) => {
            const de = i === 0 ? 0 : arr[i - 1].ate + 1;
            return (
              <span key={i}>
                Critério {de}–{f.ate}: <b className="coins">{f.preco} pts</b>
              </span>
            );
          })}
        </div>
        {(jogador.historico || []).length ? (
          <div style={{ marginTop: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Últimas compras</div>
            {jogador.historico.slice(-8).reverse().map((h, i) => (
              <div
                key={i}
                className="row"
                style={{ justifyContent: "space-between", borderBottom: "1px solid var(--line)", padding: "7px 0" }}
              >
                <span>{h.txt}</span>
                <span className="coins">−{h.custo}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <Toast msg={msg} />
    </>
  );
}
