"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copa, ROTULO_STATUS, campeaoDaCopa } from "@/lib/copa";
import { formatarData, hojeISO } from "@/lib/domain";
import { criarCopa, registrarEdicaoAntiga } from "@/lib/actions-copa";
import { Modal, Toast, useToast } from "@/components/ui";

export default function ListaCopas({ copas, podeCriar }: { copas: Copa[]; podeCriar: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const { msg, avisar } = useToast();
  const [criando, setCriando] = useState(false);
  const [antiga, setAntiga] = useState(false);

  const proxima = Math.max(0, ...copas.map((c) => c.edicao || 0)) + 1;
  const [nome, setNome] = useState("");
  const [edicao, setEdicao] = useState(proxima);
  const [data, setData] = useState(hojeISO());
  const [campeoes, setCampeoes] = useState(["", "", "", "", ""]);

  function criar() {
    iniciar(async () => {
      const r = await criarCopa(nome.trim() || `Copa Fofo — ${edicao}ª edição`, edicao, data);
      if (!r.ok) return avisar(r.erro || "Não deu para criar.");
      setCriando(false);
      router.push(`/copa/${r.id}`);
    });
  }

  function salvarAntiga() {
    iniciar(async () => {
      const r = await registrarEdicaoAntiga(
        nome.trim() || `Copa Fofo — ${edicao}ª edição`, edicao, campeoes
      );
      if (!r.ok) return avisar(r.erro || "Não deu para registrar.");
      setAntiga(false);
      setCampeoes(["", "", "", "", ""]);
      router.refresh();
      avisar(r.msg || "Edição registrada.");
    });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Edições</h1>
          <p>Cada edição é um torneio fechado: draft, fase de grupos, mata-mata e taça.</p>
        </div>
        <div className="grow" />
        {podeCriar ? (
          <>
            <button className="btn" onClick={() => { setNome(""); setEdicao(proxima); setAntiga(true); }}>
              Registrar edição antiga
            </button>
            <button
              className="btn primary"
              onClick={() => { setNome(""); setEdicao(proxima); setData(hojeISO()); setCriando(true); }}
            >
              Nova edição
            </button>
          </>
        ) : null}
      </div>

      {copas.length ? (
        <div className="stack">
          {copas.map((c) => {
            const temJogos = (c.jogos || []).length > 0;
            const campeao = c.campeao ? (c.times || []).find((t) => t.id === c.campeao) : null;
            return (
              <Link key={c.id} href={`/copa/${c.id}`} className="card pad copa-item">
                <div className="copa-medalha">{c.edicao ? `${c.edicao}ª` : "—"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="copa-nome">{c.nome}</div>
                  <div className="note">
                    {c.data ? formatarData(c.data) + " · " : ""}
                    {temJogos ? `${(c.times || []).length} times · ${(c.jogos || []).length} jogos` : "registro histórico"}
                    {campeao ? ` · campeão: ${campeao.nome}` : ""}
                  </div>
                  {(c.campeoes || []).length ? (
                    <div className="copa-campeoes">
                      {c.campeoes.map((x, i) => <span key={i} className="pill mute">{x.nome}</span>)}
                    </div>
                  ) : null}
                </div>
                <span className={"pill " + (c.status === "encerrada" ? "ok" : "warn")}>
                  {ROTULO_STATUS[c.status] || c.status}
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="card empty">
          <h3>Nenhuma edição ainda</h3>
          <p>{podeCriar ? "Crie a próxima edição ou registre as que já aconteceram." : "Ninguém abriu edição ainda."}</p>
        </div>
      )}

      {criando ? (
        <Modal
          titulo="Nova edição"
          onFechar={() => setCriando(false)}
          rodape={
            <>
              <button className="btn ghost" onClick={() => setCriando(false)}>Cancelar</button>
              <button className="btn primary" onClick={criar} disabled={pendente}>
                {pendente ? "Criando…" : "Criar edição"}
              </button>
            </>
          }
        >
          <div className="grid2">
            <label className="field">
              <span>Número da edição</span>
              <input type="number" min={1} value={edicao} onChange={(e) => setEdicao(Number(e.target.value))} />
            </label>
            <label className="field">
              <span>Data</span>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>Nome</span>
            <input
              value={nome} placeholder={`Copa Fofo — ${edicao}ª edição`}
              onChange={(e) => setNome(e.target.value)}
            />
          </label>
          <p className="note">
            Depois de criar, você marca quem vai disputar, define os capitães e abre o draft.
          </p>
        </Modal>
      ) : null}

      {antiga ? (
        <Modal
          titulo="Registrar edição antiga"
          onFechar={() => setAntiga(false)}
          rodape={
            <>
              <button className="btn ghost" onClick={() => setAntiga(false)}>Cancelar</button>
              <button className="btn primary" onClick={salvarAntiga} disabled={pendente}>Registrar</button>
            </>
          }
        >
          <div className="grid2">
            <label className="field">
              <span>Número da edição</span>
              <input type="number" min={1} value={edicao} onChange={(e) => setEdicao(Number(e.target.value))} />
            </label>
            <label className="field">
              <span>Nome</span>
              <input value={nome} placeholder={`Copa Fofo — ${edicao}ª edição`} onChange={(e) => setNome(e.target.value)} />
            </label>
          </div>
          <div className="field">
            <span>Time campeão</span>
            {campeoes.map((v, i) => (
              <input
                key={i}
                value={v}
                placeholder={`Campeão ${i + 1}`}
                style={{ marginTop: 6 }}
                onChange={(e) => setCampeoes(campeoes.map((x, k) => (k === i ? e.target.value : x)))}
              />
            ))}
          </div>
          <p className="note">
            Nome que bater com alguém do elenco vira link para o perfil. Os outros ficam só como texto na galeria.
          </p>
        </Modal>
      ) : null}

      <Toast msg={msg} />
    </>
  );
}
