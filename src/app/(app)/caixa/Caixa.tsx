"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  CATEGORIAS_CAIXA, Lancamento, TipoLancamento,
  formatarBRL, formatarData, hojeISO, resumoCaixa, rotuloMes,
} from "@/lib/domain";
import { excluirLancamento, salvarLancamento } from "@/lib/actions";
import { Confirmar, Modal, Toast, useToast } from "@/components/ui";

type Rascunho = {
  id?: string;
  data: string;
  descricao: string;
  tipo: TipoLancamento;
  valor: string;
  categoria: string;
};

const vazio = (tipo: TipoLancamento): Rascunho => ({
  data: hojeISO(), descricao: "", tipo, valor: "", categoria: "",
});

export default function Caixa({
  lancamentos, podeLancar,
}: { lancamentos: Lancamento[]; podeLancar: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const { msg, avisar } = useToast();
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [apagando, setApagando] = useState<Lancamento | null>(null);

  const { saldo, entradas, saidas } = resumoCaixa(lancamentos);

  /* extrato agrupado por mês, do mais recente para o mais antigo */
  const meses = useMemo(() => {
    const mapa = new Map<string, Lancamento[]>();
    for (const l of lancamentos) {
      const chave = (l.data || "").slice(0, 7);
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(l);
    }
    return Array.from(mapa.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [lancamentos]);

  function salvar() {
    if (!rascunho) return;
    const valor = Number(String(rascunho.valor).replace(/\./g, "").replace(",", "."));
    if (!(valor > 0)) return avisar("Coloque um valor maior que zero.");
    iniciar(async () => {
      const r = await salvarLancamento({
        id: rascunho.id,
        data: rascunho.data,
        descricao: rascunho.descricao,
        tipo: rascunho.tipo,
        valor,
        categoria: rascunho.categoria,
      });
      if (!r.ok) return avisar(r.erro || "Não deu para salvar.");
      setRascunho(null);
      router.refresh();
      avisar(r.msg || "Lançamento salvo.");
    });
  }

  function confirmarExclusao() {
    const alvo = apagando;
    if (!alvo) return;
    iniciar(async () => {
      const r = await excluirLancamento(alvo.id);
      setApagando(null);
      if (!r.ok) return avisar(r.erro || "Não deu para apagar.");
      router.refresh();
      avisar("Lançamento apagado.");
    });
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Caixa</h1>
          <p>O dinheiro da pelada: o que entrou, o que saiu e quanto sobra.</p>
        </div>
        <div className="grow" />
        {podeLancar ? (
          <>
            <button className="btn" onClick={() => setRascunho(vazio("saida"))}>Nova despesa</button>
            <button className="btn primary" onClick={() => setRascunho(vazio("entrada"))}>Nova entrada</button>
          </>
        ) : null}
      </div>

      <div className="caixa-resumo">
        <div className={"saldo" + (saldo < 0 ? " negativo" : "")}>
          <span className="eyebrow">Saldo em caixa</span>
          <strong>{formatarBRL(saldo)}</strong>
          <span className="note">
            {lancamentos.length} {lancamentos.length === 1 ? "lançamento" : "lançamentos"}
          </span>
        </div>
        <div className="fluxo">
          <div className="fluxo-item entrada">
            <span className="eyebrow">Entradas</span>
            <strong>{formatarBRL(entradas)}</strong>
          </div>
          <div className="fluxo-item saida">
            <span className="eyebrow">Saídas</span>
            <strong>{formatarBRL(saidas)}</strong>
          </div>
        </div>
      </div>

      {!lancamentos.length ? (
        <div className="card empty" style={{ marginTop: 16 }}>
          <h3>Caixa zerado</h3>
          <p>
            {podeLancar
              ? "Lance a primeira mensalidade recebida ou o aluguel da quadra para começar o controle."
              : "Ninguém registrou movimentação ainda."}
          </p>
        </div>
      ) : (
        <div className="stack" style={{ marginTop: 16 }}>
          {meses.map(([chave, itens]) => {
            const r = resumoCaixa(itens);
            return (
              <div className="card" key={chave}>
                <div className="mes-cab">
                  <span className="mes-nome">{rotuloMes(chave)}</span>
                  <span className="note">
                    +{formatarBRL(r.entradas)} · −{formatarBRL(r.saidas)}
                  </span>
                  <span className={"mes-saldo" + (r.saldo < 0 ? " negativo" : "")}>{formatarBRL(r.saldo)}</span>
                </div>
                <div className="tablewrap">
                  <table className="tb-compacta">
                    <thead>
                      <tr>
                        <th className="l" style={{ width: 74 }}>Data</th>
                        <th className="l">Descrição</th>
                        <th className="l opt">Categoria</th>
                        <th>Valor</th>
                        {podeLancar ? <th className="l" style={{ width: 90 }} /> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((l) => (
                        <tr key={l.id}>
                          <td className="l">{formatarData(l.data)}</td>
                          <td className="l">
                            <span className={"seta " + l.tipo}>{l.tipo === "entrada" ? "▲" : "▼"}</span>
                            {l.descricao}
                            {l.criado_por ? <span className="note autor"> · {l.criado_por}</span> : null}
                          </td>
                          <td className="l opt">
                            {l.categoria ? <span className="pill mute">{l.categoria}</span> : null}
                          </td>
                          <td className={"valor " + l.tipo}>
                            {l.tipo === "entrada" ? "+" : "−"}{formatarBRL(l.valor)}
                          </td>
                          {podeLancar ? (
                            <td className="l">
                              <button
                                className="btn-icone"
                                title="Editar"
                                onClick={() =>
                                  setRascunho({
                                    id: l.id,
                                    data: l.data.slice(0, 10),
                                    descricao: l.descricao,
                                    tipo: l.tipo,
                                    valor: String(l.valor).replace(".", ","),
                                    categoria: l.categoria || "",
                                  })
                                }
                              >
                                ✎
                              </button>
                              <button className="btn-icone" title="Apagar" onClick={() => setApagando(l)}>×</button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!podeLancar ? (
        <p className="note" style={{ marginTop: 10 }}>
          Só o mestre e os organizadores lançam no caixa. Todo mundo enxerga o saldo.
        </p>
      ) : null}

      {rascunho ? (
        <Modal
          titulo={rascunho.id ? "Editar lançamento" : rascunho.tipo === "entrada" ? "Nova entrada" : "Nova despesa"}
          onFechar={() => setRascunho(null)}
          rodape={
            <>
              <button className="btn ghost" onClick={() => setRascunho(null)}>Cancelar</button>
              <button className="btn primary" onClick={salvar} disabled={pendente}>
                {pendente ? "Salvando…" : "Salvar"}
              </button>
            </>
          }
        >
          <div className="field">
            <span>Tipo</span>
            <div className="row">
              <button
                type="button" className="chip" aria-pressed={rascunho.tipo === "entrada"}
                onClick={() => setRascunho({ ...rascunho, tipo: "entrada" })}
              >
                Entrada
              </button>
              <button
                type="button" className="chip" aria-pressed={rascunho.tipo === "saida"}
                onClick={() => setRascunho({ ...rascunho, tipo: "saida" })}
              >
                Saída
              </button>
            </div>
          </div>

          <label className="field">
            <span>Descrição</span>
            <input
              value={rascunho.descricao}
              autoFocus
              placeholder={rascunho.tipo === "entrada" ? "Ex.: mensalidade de setembro" : "Ex.: aluguel da quadra"}
              onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })}
            />
          </label>

          <div className="grid2">
            <label className="field">
              <span>Valor (R$)</span>
              <input
                inputMode="decimal"
                placeholder="0,00"
                value={rascunho.valor}
                onChange={(e) => setRascunho({ ...rascunho, valor: e.target.value.replace(/[^\d.,]/g, "") })}
              />
            </label>
            <label className="field">
              <span>Data</span>
              <input
                type="date"
                value={rascunho.data}
                onChange={(e) => setRascunho({ ...rascunho, data: e.target.value })}
              />
            </label>
          </div>

          <label className="field">
            <span>Categoria (opcional)</span>
            <input
              list="categorias-caixa"
              value={rascunho.categoria}
              placeholder="Ex.: aluguel da quadra"
              onChange={(e) => setRascunho({ ...rascunho, categoria: e.target.value })}
            />
            <datalist id="categorias-caixa">
              {CATEGORIAS_CAIXA.map((c) => <option key={c} value={c} />)}
            </datalist>
          </label>
        </Modal>
      ) : null}

      {apagando ? (
        <Confirmar
          titulo="Apagar lançamento?"
          texto={`"${apagando.descricao}" de ${formatarBRL(apagando.valor)} sai do caixa e o saldo é recalculado.`}
          labelOk="Apagar"
          onOk={confirmarExclusao}
          onCancelar={() => setApagando(null)}
        />
      ) : null}

      <Toast msg={msg} />
    </>
  );
}
