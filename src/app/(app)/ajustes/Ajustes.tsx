"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Config } from "@/lib/domain";
import { criarElencoExemplo, salvarConfig } from "@/lib/actions";
import { Toast, useToast } from "@/components/ui";

export default function Ajustes({ cfg }: { cfg: Config }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const { msg, avisar } = useToast();
  const [f, setF] = useState<Record<string, any>>({
    pontos_vitoria: cfg.pontos_vitoria,
    pontos_gol: cfg.pontos_gol,
    pontos_assist: cfg.pontos_assist,
    qtd_times: cfg.qtd_times,
    duracao_min: cfg.duracao_min,
    gols_limite: cfg.gols_limite,
    nome_pelada: cfg.nome_pelada,
    admin_pin: cfg.admin_pin,
    ...Object.fromEntries((cfg.faixas || []).map((x, i) => ["faixa" + i, x.preco])),
  });

  const set = (k: string, v: any) => setF((old) => ({ ...old, [k]: v }));

  function salvar() {
    iniciar(async () => {
      const r = await salvarConfig(f);
      if (!r.ok) return avisar(r.erro || "Não deu para salvar.");
      router.refresh();
      avisar(r.msg || "Ajustes salvos.");
    });
  }

  const Num = ({ k, label }: { k: string; label: string }) => (
    <label className="field">
      <span>{label}</span>
      <input type="number" min={0} value={f[k]} onChange={(e) => set(k, e.target.value)} />
    </label>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ajustes</h1>
          <p>Regras da pelada. Valem para as próximas rodadas fechadas.</p>
        </div>
      </div>

      <div className="stack">
        <div className="card pad stack">
          <div className="sect-title">Pontos por desempenho</div>
          <div className="grid2">
            <Num k="pontos_vitoria" label="Rodada vencida" />
            <Num k="pontos_gol" label="Cada gol" />
            <Num k="pontos_assist" label="Cada assistência" />
          </div>
          <p className="note">
            Os {f.pontos_vitoria} pontos vão para todos os jogadores do time com mais vitórias no dia.
          </p>
        </div>

        <div className="card pad stack">
          <div className="sect-title">Preço na loja</div>
          <div className="grid2">
            {(cfg.faixas || []).map((x, i, arr) => {
              const de = i === 0 ? 0 : arr[i - 1].ate + 1;
              return <Num key={i} k={"faixa" + i} label={`Critério ${de}–${x.ate}`} />;
            })}
          </div>
          <p className="note">Custo para subir +1 ponto no critério, conforme o valor atual dele.</p>
        </div>

        <div className="card pad stack">
          <div className="sect-title">A partida</div>
          <div className="grid2">
            <Num k="duracao_min" label="Duração (minutos)" />
            <Num k="gols_limite" label="Limite de gols" />
            <label className="field">
              <span>Times por rodada</span>
              <select value={f.qtd_times} onChange={(e) => set("qtd_times", e.target.value)}>
                {[2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <p className="note">
            O cronômetro de cada confronto começa em {f.duracao_min || 0} minutos. Ao bater o tempo ou{" "}
            {f.gols_limite || 0} gols, o site avisa — quem encerra a partida é você.
            Coloque 0 no limite de gols para valer só o tempo.
          </p>
        </div>

        <div className="card pad stack">
          <div className="sect-title">Geral</div>
          <div className="grid2">
            <label className="field">
              <span>Nome da pelada</span>
              <input value={f.nome_pelada} onChange={(e) => set("nome_pelada", e.target.value)} />
            </label>
            <label className="field">
              <span>PIN do mestre</span>
              <input maxLength={8} value={f.admin_pin} onChange={(e) => set("admin_pin", e.target.value)} />
            </label>
          </div>
          <p className="note">
            Troque o PIN do mestre assim que o site entrar no ar — ele é a única chave do painel.
          </p>
        </div>

        <div className="row">
          <button className="btn primary" onClick={salvar} disabled={pendente}>
            {pendente ? "Salvando…" : "Salvar ajustes"}
          </button>
          <button
            className="btn ghost"
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
      </div>

      <Toast msg={msg} />
    </>
  );
}
