"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Config, Round, formatarData, hojeISO } from "@/lib/domain";
import { criarRodada } from "@/lib/actions";
import { Modal, Toast, useToast } from "@/components/ui";

export default function ListaRodadas({
  rodadas, admin, cfg,
}: { rodadas: Round[]; admin: boolean; cfg: Config }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const { msg, avisar } = useToast();
  const [criando, setCriando] = useState(false);
  const [data, setData] = useState(hojeISO());
  const [nome, setNome] = useState("");

  function criar() {
    iniciar(async () => {
      const r = await criarRodada(data, nome.trim());
      if (!r.ok) return avisar(r.erro || "Não deu para criar.");
      setCriando(false);
      router.push(`/rodadas/${r.id}`);
    });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Rodadas</h1>
          <p>Cada dia de pelada é uma rodada: sorteio, confrontos e distribuição de pontos.</p>
        </div>
        <div className="grow" />
        {admin ? (
          <button className="btn primary" onClick={() => { setData(hojeISO()); setNome(""); setCriando(true); }}>
            Nova rodada
          </button>
        ) : null}
      </div>

      {rodadas.length ? (
        <div className="stack">
          {rodadas.map((r) => {
            const campeao = r.campeao ? (r.teams || []).find((t) => t.id === r.campeao) : null;
            return (
              <Link
                key={r.id}
                href={`/rodadas/${r.id}`}
                className="card pad"
                style={{ display: "flex", gap: 12, alignItems: "center", textDecoration: "none" }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="eyebrow">{formatarData(r.data)}</div>
                  <div style={{ fontFamily: "var(--f-display)", fontSize: 19, textTransform: "uppercase", letterSpacing: ".4px" }}>
                    {r.nome || "Rodada " + formatarData(r.data)}
                  </div>
                  <div className="note">
                    {(r.teams || []).length} times · {(r.matches || []).length} confrontos
                    {campeao ? " · campeão: " + campeao.nome : ""}
                  </div>
                </div>
                <span className={"pill " + (r.status === "finalizada" ? "ok" : "warn")}>
                  {r.status === "finalizada" ? "Fechada" : "Aberta"}
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="card empty">
          <h3>Nenhuma rodada ainda</h3>
          <p>
            {admin
              ? "Crie a rodada do próximo fim de semana, marque quem confirmou e sorteie os times."
              : "O mestre da pelada ainda não abriu nenhuma rodada."}
          </p>
        </div>
      )}

      {criando ? (
        <Modal
          titulo="Nova rodada"
          onFechar={() => setCriando(false)}
          rodape={
            <>
              <button className="btn ghost" onClick={() => setCriando(false)}>Cancelar</button>
              <button className="btn primary" onClick={criar} disabled={pendente}>
                {pendente ? "Criando…" : "Criar rodada"}
              </button>
            </>
          }
        >
          <label className="field">
            <span>Data</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} autoFocus />
          </label>
          <label className="field">
            <span>Nome (opcional)</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Pelada de sábado" />
          </label>
          <p className="note">
            Todos os mensalistas ativos já entram marcados como confirmados — é só desmarcar quem faltar.
            Regra dos confrontos hoje: {cfg.regra_partida}.
          </p>
        </Modal>
      ) : null}

      <Toast msg={msg} />
    </>
  );
}
