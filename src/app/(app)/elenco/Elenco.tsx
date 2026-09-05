"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ATTRS, BASES, POSITIONS, POS_FULL, Player, Pos, ovr } from "@/lib/domain";
import { criarElencoExemplo, excluirJogador, salvarJogador } from "@/lib/actions";
import { Confirmar, Modal, Ovr, PosTag, Toast, useToast } from "@/components/ui";

type Rascunho = {
  id?: string;
  nome: string;
  pos: Pos;
  alt: Pos[];
  tipo: "mensalista" | "avulso";
  base: number;
  atr: Record<string, number>;
  moedas: number;
  pin: string;
  ativo: boolean;
  organizador: boolean;
};

function vazio(tipo: "mensalista" | "avulso" = "mensalista"): Rascunho {
  return {
    nome: "", pos: "ALA", alt: [], tipo, base: 65,
    atr: { fin: 65, vis: 65, def: 65, int: 65 }, moedas: 0, pin: "", ativo: true,
    organizador: false,
  };
}

function deJogador(p: Player): Rascunho {
  return {
    id: p.id, nome: p.nome, pos: p.pos, alt: p.alt || [], tipo: p.tipo, base: 65,
    atr: { fin: p.atr_fin, vis: p.atr_vis, def: p.atr_def, int: p.atr_int },
    moedas: p.moedas, pin: p.pin || "", ativo: p.ativo !== false,
    organizador: !!p.organizador,
  };
}

export default function Elenco({ jogadores, admin }: { jogadores: Player[]; admin: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const { msg, avisar } = useToast();
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [excluindo, setExcluindo] = useState<Player | null>(null);

  const lista = jogadores.slice().sort((a, b) => a.nome.localeCompare(b.nome));
  const novo = !rascunho?.id;

  function salvar() {
    if (!rascunho) return;
    iniciar(async () => {
      const r = await salvarJogador({
        id: rascunho.id,
        nome: rascunho.nome,
        pos: rascunho.pos,
        alt: rascunho.alt,
        tipo: rascunho.tipo,
        base: rascunho.base,
        atr: rascunho.atr as any,
        moedas: rascunho.moedas,
        pin: rascunho.pin,
        ativo: rascunho.ativo,
        organizador: rascunho.organizador,
      });
      if (!r.ok) return avisar(r.erro || "Não deu para salvar.");
      setRascunho(null);
      router.refresh();
      avisar(novo ? "Jogador cadastrado." : "Alterações salvas.");
    });
  }

  function confirmarExclusao() {
    const alvo = excluindo;
    if (!alvo) return;
    iniciar(async () => {
      const r = await excluirJogador(alvo.id);
      setExcluindo(null);
      setRascunho(null);
      if (!r.ok) return avisar(r.erro || "Não deu para excluir.");
      router.refresh();
      avisar(`${alvo.nome} foi excluído do elenco.`);
    });
  }

  if (!lista.length) {
    return (
      <>
        <div className="card empty">
          <h3>Sem elenco ainda</h3>
          <p style={{ maxWidth: "44ch", margin: "0 auto 16px" }}>
            Cadastre a galera com nome, posição e nota base (60 a 80). Todo jogador recebe um PIN
            de 4 dígitos para entrar e acompanhar os próprios números.
          </p>
          {admin ? (
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn primary" onClick={() => setRascunho(vazio())}>Cadastrar jogador</button>
              <button
                className="btn"
                disabled={pendente}
                onClick={() => iniciar(async () => {
                  const r = await criarElencoExemplo();
                  router.refresh();
                  avisar(r.ok ? r.msg! : r.erro!);
                })}
              >
                Criar elenco de exemplo
              </button>
            </div>
          ) : (
            <p className="note">O mestre da pelada ainda não montou o elenco.</p>
          )}
        </div>
        {rascunho ? <FormJogador {...{ rascunho, setRascunho, salvar, pendente, novo, setExcluindo, jogadores }} /> : null}
        <Toast msg={msg} />
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Elenco</h1>
          <p>
            {lista.length} cadastrados · {lista.filter((p) => p.tipo !== "avulso").length} mensalistas.
          </p>
        </div>
        <div className="grow" />
        {admin ? (
          <button className="btn primary" onClick={() => setRascunho(vazio())}>Novo jogador</button>
        ) : null}
      </div>

      <div className="card">
        <div className="tablewrap">
          <table style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th className="l">Jogador</th>
                <th className="l">Pos</th>
                <th className="l">Tipo</th>
                <th>Ovr</th>
                {ATTRS.map((a) => <th key={a.k}>{a.nome.slice(0, 3).toUpperCase()}</th>)}
                <th>Pontos</th>
                <th className="l">PIN</th>
                {admin ? <th className="l" /> : null}
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id} style={p.ativo === false ? { opacity: 0.5 } : undefined}>
                  <td className="l">
                    <Link className="chip" href={`/jogador/${p.id}`}>{p.nome}</Link>
                  </td>
                  <td className="l"><PosTag pos={p.pos} /></td>
                  <td className="l">
                    <span className="pill mute">{p.tipo === "avulso" ? "Avulso" : "Mensalista"}</span>
                    {p.organizador ? <span className="pill ok" style={{ marginLeft: 5 }}>Organizador</span> : null}
                  </td>
                  <td><Ovr v={ovr(p)} /></td>
                  {ATTRS.map((a) => <td key={a.k}>{p[("atr_" + a.k) as "atr_fin"]}</td>)}
                  <td className="coins">{p.moedas}</td>
                  <td className="l" style={{ letterSpacing: ".15em" }}>{admin ? (p.pin || "—") : "••••"}</td>
                  {admin ? (
                    <td className="l">
                      <button className="btn sm ghost" onClick={() => setRascunho(deJogador(p))}>Editar</button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!admin ? (
        <p className="note" style={{ marginTop: 10 }}>
          Só o mestre da pelada cadastra e edita jogadores.
        </p>
      ) : null}

      {rascunho ? <FormJogador {...{ rascunho, setRascunho, salvar, pendente, novo, setExcluindo, jogadores }} /> : null}

      {excluindo ? (
        <Confirmar
          titulo={`Excluir ${excluindo.nome}?`}
          texto="As rodadas já fechadas continuam com os números dele, mas o nome sai do ranking e dos sorteios. Se ele só parou de aparecer, prefira desmarcar “Ativo no elenco”."
          labelOk="Excluir mesmo assim"
          onOk={confirmarExclusao}
          onCancelar={() => setExcluindo(null)}
        />
      ) : null}

      <Toast msg={msg} />
    </>
  );
}

function FormJogador({
  rascunho, setRascunho, salvar, pendente, novo, setExcluindo, jogadores,
}: any) {
  const r: Rascunho = rascunho;
  const set = (patch: Partial<Rascunho>) => setRascunho({ ...r, ...patch });

  return (
    <Modal
      titulo={novo ? "Novo jogador" : "Editar jogador"}
      onFechar={() => setRascunho(null)}
      rodape={
        <>
          {!novo ? (
            <button
              className="btn ghost danger"
              onClick={() => setExcluindo(jogadores.find((p: Player) => p.id === r.id))}
            >
              Excluir
            </button>
          ) : null}
          <div className="grow" />
          <button className="btn ghost" onClick={() => setRascunho(null)}>Cancelar</button>
          <button className="btn primary" onClick={salvar} disabled={pendente}>
            {pendente ? "Salvando…" : "Salvar"}
          </button>
        </>
      }
    >
      <label className="field">
        <span>Nome</span>
        <input value={r.nome} onChange={(e) => set({ nome: e.target.value })} autoFocus />
      </label>

      <div className="grid2">
        <label className="field">
          <span>Posição principal</span>
          <select value={r.pos} onChange={(e) => set({ pos: e.target.value as Pos })}>
            {POSITIONS.map((x) => <option key={x} value={x}>{POS_FULL[x]}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Tipo</span>
          <select value={r.tipo} onChange={(e) => set({ tipo: e.target.value as any })}>
            <option value="mensalista">Mensalista</option>
            <option value="avulso">Avulso</option>
          </select>
        </label>
      </div>

      <div className="field">
        <span>Também joga de</span>
        <div className="row">
          {POSITIONS.map((x) => {
            const ativo = r.alt.includes(x);
            return (
              <button
                key={x}
                type="button"
                className="chip"
                aria-pressed={ativo}
                onClick={() => set({ alt: ativo ? r.alt.filter((y) => y !== x) : [...r.alt, x] })}
              >
                {POS_FULL[x]}
              </button>
            );
          })}
        </div>
      </div>

      {novo ? (
        <div className="field">
          <span>Nota base</span>
          <div className="row">
            {BASES.map((b) => (
              <button
                key={b}
                type="button"
                className="chip"
                aria-pressed={r.base === b}
                onClick={() => set({ base: b })}
              >
                {b}
              </button>
            ))}
          </div>
          <span className="note" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>
            Os quatro critérios começam nesse valor. Dá para ajustar um a um depois.
          </span>
        </div>
      ) : (
        <>
          <div className="grid2">
            {ATTRS.map((a) => (
              <label className="field" key={a.k}>
                <span>{a.nome}</span>
                <input
                  type="number" min={1} max={99}
                  value={r.atr[a.k]}
                  onChange={(e) => set({ atr: { ...r.atr, [a.k]: Number(e.target.value) } })}
                />
              </label>
            ))}
          </div>
          <div className="grid2">
            <label className="field">
              <span>Pontos na carteira</span>
              <input
                type="number" min={0} value={r.moedas}
                onChange={(e) => set({ moedas: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <span>PIN</span>
              <input maxLength={4} value={r.pin} onChange={(e) => set({ pin: e.target.value })} />
            </label>
          </div>
          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox" style={{ width: "auto" }} checked={r.ativo}
              onChange={(e) => set({ ativo: e.target.checked })}
            />
            <span>Ativo no elenco</span>
          </label>
          <label className="row" style={{ gap: 8, alignItems: "flex-start" }}>
            <input
              type="checkbox" style={{ width: "auto", marginTop: 3 }} checked={r.organizador}
              onChange={(e) => set({ organizador: e.target.checked })}
            />
            <span>
              Organizador
              <span className="note" style={{ display: "block" }}>
                Cria rodadas, sorteia, apita e fecha — tudo que o mestre faz dentro das rodadas.
              </span>
            </span>
          </label>
        </>
      )}
    </Modal>
  );
}
