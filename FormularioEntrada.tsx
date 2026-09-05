"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { entrarComoAdmin, entrarComoJogador } from "@/lib/actions";

export default function FormularioEntrada({
  jogadores, falha,
}: { jogadores: { id: string; nome: string }[]; falha: string | null }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [id, setId] = useState("");
  const [pin, setPin] = useState("");
  const [modoMestre, setModoMestre] = useState(false);
  const [pinMestre, setPinMestre] = useState("");

  function entrarJogador(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await entrarComoJogador(id, pin);
      if (!r.ok) setErro(r.erro || "Não deu para entrar.");
      else router.replace("/ranking");
    });
  }

  function entrarMestre(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    iniciar(async () => {
      const r = await entrarComoAdmin(pinMestre);
      if (!r.ok) setErro(r.erro || "Não deu para entrar.");
      else router.replace("/ranking");
    });
  }

  if (falha) {
    return (
      <div className="login-box">
        <h2>Banco não conectado</h2>
        <div className="erro">{falha}</div>
        <p className="note">
          Confira as variáveis <b>SUPABASE_URL</b> e <b>SUPABASE_SERVICE_ROLE_KEY</b> no arquivo
          <b> .env.local</b> (no seu computador) ou em Settings → Environment Variables (na Vercel).
        </p>
      </div>
    );
  }

  return (
    <div className="login-box">
      <div>
        <span className="eyebrow">Entrar</span>
        <h2>{modoMestre ? "Mestre da pelada" : "Bora jogar"}</h2>
      </div>

      {erro ? <div className="erro">{erro}</div> : null}

      {!modoMestre ? (
        <form onSubmit={entrarJogador} className="stack" style={{ gap: 13 }}>
          <label className="field">
            <span>Seu nome</span>
            <select value={id} onChange={(e) => setId(e.target.value)} required>
              <option value="">— escolha na lista —</option>
              {jogadores.map((j) => (
                <option key={j.id} value={j.id}>{j.nome}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Seu PIN</span>
            <input
              className="pinput"
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              required
            />
          </label>
          <button className="btn primary block" disabled={pendente}>
            {pendente ? "Entrando…" : "Entrar"}
          </button>
          {jogadores.length === 0 ? (
            <p className="note">
              Nenhum jogador cadastrado ainda. Entre como mestre da pelada para montar o elenco.
            </p>
          ) : null}
        </form>
      ) : (
        <form onSubmit={entrarMestre} className="stack" style={{ gap: 13 }}>
          <label className="field">
            <span>PIN do mestre</span>
            <input
              className="pinput"
              inputMode="numeric"
              maxLength={8}
              placeholder="••••"
              value={pinMestre}
              onChange={(e) => setPinMestre(e.target.value)}
              autoFocus
              required
            />
          </label>
          <button className="btn dark block" disabled={pendente}>
            {pendente ? "Entrando…" : "Entrar como mestre"}
          </button>
        </form>
      )}

      <div className="linha-ou">ou</div>
      <button className="btn ghost block" onClick={() => { setErro(null); setModoMestre(!modoMestre); }}>
        {modoMestre ? "Entrar como jogador" : "Sou o mestre da pelada"}
      </button>
      <p className="note">
        Esqueceu o PIN? O mestre da pelada consegue ver o seu na aba Elenco.
      </p>
    </div>
  );
}
