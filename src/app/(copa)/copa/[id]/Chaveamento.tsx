"use client";

import { CopaJogo, CopaTime, golsDoLado, vencedorDoJogo } from "@/lib/copa";

/** Chaveamento desenhado: semifinais, final e a taça. */
export default function Chaveamento({
  semis, final, times, eliminadoNoGrupo,
}: {
  semis: CopaJogo[];
  final: CopaJogo | null;
  times: CopaTime[];
  eliminadoNoGrupo: CopaTime | null;
}) {
  const nome = (id: string) => times.find((t) => t.id === id)?.nome || "—";
  const cor = (id: string) => times.find((t) => t.id === id)?.hex || "#888";
  const campeao = final ? vencedorDoJogo(final) : null;

  return (
    <div className="chave">
      <div className="chave-col">
        <span className="chave-titulo">Semifinais</span>
        {semis.length ? semis.map((j) => <Confronto key={j.id} j={j} nome={nome} cor={cor} />) : (
          <div className="chave-vazio">a definir</div>
        )}
      </div>

      <div className="chave-col liga">
        <span className="chave-titulo">Final</span>
        {final ? <Confronto j={final} nome={nome} cor={cor} destaque /> : (
          <div className="chave-vazio">sai dos vencedores das semis</div>
        )}
      </div>

      <div className="chave-col">
        <span className="chave-titulo">Campeão</span>
        {campeao ? (
          <div className="chave-taca">
            <span className="chave-swatch" style={{ background: cor(campeao) }} />
            <strong>{nome(campeao)}</strong>
          </div>
        ) : (
          <div className="chave-vazio">a taça espera</div>
        )}
      </div>

      {eliminadoNoGrupo ? (
        <div className="chave-rodape">
          <span className="pill bad">Eliminado na fase de grupos</span>
          <span className="chave-swatch" style={{ background: eliminadoNoGrupo.hex }} />
          {eliminadoNoGrupo.nome}
        </div>
      ) : null}
    </div>
  );
}

function Confronto({
  j, nome, cor, destaque,
}: { j: CopaJogo; nome: (id: string) => string; cor: (id: string) => string; destaque?: boolean }) {
  const ga = golsDoLado(j, "a"), gb = golsDoLado(j, "b");
  const vencedor = vencedorDoJogo(j);
  const jogado = j.status === "encerrada";
  const pen = j.penA != null && j.penB != null;

  return (
    <div className={"chave-jogo" + (destaque ? " final" : "")}>
      {[["a", j.a, ga, j.penA] as const, ["b", j.b, gb, j.penB] as const].map(([lado, id, gols, penaltis]) => (
        <div className={"chave-lado" + (vencedor === id ? " passa" : vencedor ? " cai" : "")} key={lado}>
          <span className="chave-swatch" style={{ background: cor(id) }} />
          <span className="chave-nome">{nome(id)}</span>
          {pen ? <span className="chave-pen">({penaltis})</span> : null}
          <span className="chave-gols">{jogado ? gols : "–"}</span>
        </div>
      ))}
    </div>
  );
}
