"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { POSITIONS, POS_FULL, Pos } from "@/lib/domain";
import { salvarPosicao } from "@/lib/actions";
import { Modal, Toast, useToast } from "@/components/ui";

export default function TrocarPosicao({
  playerId, pos, alt,
}: { playerId: string; pos: Pos; alt: Pos[] }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const { msg, avisar } = useToast();
  const [aberto, setAberto] = useState(false);
  const [principal, setPrincipal] = useState<Pos>(pos);
  const [outras, setOutras] = useState<Pos[]>(alt || []);
  const [erro, setErro] = useState<string | null>(null);

  function abrir() {
    setPrincipal(pos);
    setOutras(alt || []);
    setErro(null);
    setAberto(true);
  }

  function escolherPrincipal(x: Pos) {
    setPrincipal(x);
    /* a principal sai da lista de alternativas, senão fica repetido */
    setOutras((o) => o.filter((y) => y !== x));
  }

  function alternar(x: Pos) {
    setOutras((o) => (o.includes(x) ? o.filter((y) => y !== x) : [...o, x]));
  }

  function salvar() {
    setErro(null);
    iniciar(async () => {
      const r = await salvarPosicao(playerId, principal, outras);
      if (!r.ok) return setErro(r.erro || "Não deu para salvar.");
      setAberto(false);
      router.refresh();
      avisar(r.msg || "Posição atualizada.");
    });
  }

  return (
    <>
      <button className="btn sm" onClick={abrir}>Mudar posição</button>

      {aberto ? (
        <Modal
          titulo="Minha posição"
          onFechar={() => setAberto(false)}
          rodape={
            <>
              <div className="grow" />
              <button className="btn ghost" onClick={() => setAberto(false)}>Cancelar</button>
              <button className="btn primary" onClick={salvar} disabled={pendente}>
                {pendente ? "Salvando…" : "Salvar"}
              </button>
            </>
          }
        >
          <div className="field">
            <span>Onde eu jogo</span>
            <div className="row">
              {POSITIONS.map((x) => (
                <button
                  key={x}
                  type="button"
                  className="chip"
                  aria-pressed={principal === x}
                  onClick={() => escolherPrincipal(x)}
                >
                  {POS_FULL[x]}
                </button>
              ))}
            </div>
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <span>Também quebro um galho de</span>
            <div className="row">
              {POSITIONS.filter((x) => x !== principal).map((x) => (
                <button
                  key={x}
                  type="button"
                  className="chip"
                  aria-pressed={outras.includes(x)}
                  onClick={() => alternar(x)}
                >
                  {POS_FULL[x]}
                </button>
              ))}
            </div>
            <span className="note" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>
              O sorteio usa a posição principal primeiro. As outras entram quando
              falta gente pra fechar um time.
            </span>
          </div>

          {erro ? <div className="erro" style={{ marginTop: 14 }}>{erro}</div> : null}
        </Modal>
      ) : null}

      <Toast msg={msg} />
    </>
  );
}
