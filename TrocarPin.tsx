"use client";

import { useState, useTransition } from "react";
import { trocarMeuPin } from "@/lib/actions";
import { Modal, Toast, useToast } from "@/components/ui";

export default function TrocarPin() {
  const [pendente, iniciar] = useTransition();
  const { msg, avisar } = useToast();
  const [aberto, setAberto] = useState(false);
  const [atual, setAtual] = useState("");
  const [novo, setNovo] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const soNumeros = (v: string) => v.replace(/\D/g, "").slice(0, 4);

  function fechar() {
    setAberto(false);
    setAtual(""); setNovo(""); setConfirma(""); setErro(null);
  }

  function salvar() {
    setErro(null);
    if (novo.length !== 4) return setErro("O novo PIN precisa ter 4 números.");
    if (novo !== confirma) return setErro("A confirmação não bate com o novo PIN.");
    iniciar(async () => {
      const r = await trocarMeuPin(atual, novo);
      if (!r.ok) return setErro(r.erro || "Não deu para trocar.");
      fechar();
      avisar(r.msg || "PIN trocado.");
    });
  }

  return (
    <>
      <button className="btn sm" onClick={() => setAberto(true)}>Trocar meu PIN</button>

      {aberto ? (
        <Modal
          titulo="Trocar meu PIN"
          onFechar={fechar}
          rodape={
            <>
              <button className="btn ghost" onClick={fechar}>Cancelar</button>
              <button className="btn primary" onClick={salvar} disabled={pendente}>
                {pendente ? "Salvando…" : "Salvar novo PIN"}
              </button>
            </>
          }
        >
          {erro ? <div className="erro">{erro}</div> : null}

          <label className="field">
            <span>PIN atual</span>
            <input
              className="pinput" inputMode="numeric" maxLength={4} placeholder="••••"
              value={atual} autoFocus
              onChange={(e) => setAtual(soNumeros(e.target.value))}
            />
          </label>

          <label className="field">
            <span>Novo PIN</span>
            <input
              className="pinput" inputMode="numeric" maxLength={4} placeholder="••••"
              value={novo}
              onChange={(e) => setNovo(soNumeros(e.target.value))}
            />
          </label>

          <label className="field">
            <span>Repita o novo PIN</span>
            <input
              className="pinput" inputMode="numeric" maxLength={4} placeholder="••••"
              value={confirma}
              onChange={(e) => setConfirma(soNumeros(e.target.value))}
              onKeyDown={(e) => { if (e.key === "Enter") salvar(); }}
            />
          </label>

          <p className="note">
            São 4 números, e é a única coisa que protege a sua conta aqui. O mestre da pelada
            continua enxergando o seu PIN na aba Elenco, para te socorrer se você esquecer.
          </p>
        </Modal>
      ) : null}

      <Toast msg={msg} />
    </>
  );
}
