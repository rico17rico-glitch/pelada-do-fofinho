"use client";

import { useEffect, useState } from "react";
import { ovr, ovrTier, POS_LABEL, Pos, Player, ATTRS, POS_FULL, iniciais } from "@/lib/domain";

/** Foto de rosto; sem foto, as iniciais. */
export function Avatar({
  nome, url, tam = 34, borda,
}: { nome: string; url?: string | null; tam?: number; borda?: boolean }) {
  const estilo = { width: tam, height: tam, fontSize: Math.round(tam / 2.6) };
  if (url) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return <img className={"avatar" + (borda ? " borda" : "")} style={estilo} src={url} alt={nome} />;
  }
  return (
    <span className={"avatar vazio" + (borda ? " borda" : "")} style={estilo} aria-hidden="true">
      {iniciais(nome)}
    </span>
  );
}

export function Ovr({ v }: { v: number }) {
  return <span className={"ovr " + ovrTier(v)}>{v}</span>;
}

export function PosTag({ pos }: { pos: Pos }) {
  return <span className={"pos " + pos}>{POS_LABEL[pos]}</span>;
}

export function Swatch({ hex }: { hex: string }) {
  return <span className="swatch" style={{ background: hex || "#888" }} />;
}

export function Stepper({
  valor, onMudar, desabilitado,
}: { valor: number; onMudar: (d: number) => void; desabilitado?: boolean }) {
  if (desabilitado) return <b style={{ fontFamily: "var(--f-display)", fontSize: 18 }}>{valor}</b>;
  return (
    <span className="stepper">
      <button type="button" aria-label="menos" onClick={() => onMudar(-1)}>−</button>
      <span>{valor}</span>
      <button type="button" aria-label="mais" onClick={() => onMudar(1)}>+</button>
    </span>
  );
}

export function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div className="toast">{msg}</div>;
}

/** Guarda uma mensagem por alguns segundos. */
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3200);
    return () => clearTimeout(t);
  }, [msg]);
  return { msg, avisar: setMsg };
}

export function Modal({
  titulo, children, rodape, onFechar,
}: {
  titulo: string;
  children: React.ReactNode;
  rodape?: React.ReactNode;
  onFechar: () => void;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);

  return (
    <div className="modal-back" onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <header>
          <h3>{titulo}</h3>
          <button className="x" aria-label="Fechar" onClick={onFechar}>×</button>
        </header>
        <div className="body">{children}</div>
        {rodape ? <footer>{rodape}</footer> : null}
      </div>
    </div>
  );
}

/** Confirmação própria — nada de janela do navegador. */
export function Confirmar({
  titulo, texto, labelOk, onOk, onCancelar,
}: { titulo: string; texto: string; labelOk: string; onOk: () => void; onCancelar: () => void }) {
  return (
    <Modal
      titulo={titulo}
      onFechar={onCancelar}
      rodape={
        <>
          <button className="btn ghost" onClick={onCancelar}>Cancelar</button>
          <button className="btn primary" onClick={onOk} autoFocus>{labelOk}</button>
        </>
      }
    >
      <p>{texto}</p>
    </Modal>
  );
}

export function CardJogador({ p }: { p: Player }) {
  const alt = (p.alt || []).filter((x) => x !== p.pos);
  return (
    <div className="pcard">
      <div className="pcard-top">
        <div>
          <div className="big">{ovr(p)}</div>
          <div className="biglabel">OVERALL</div>
        </div>
        <Avatar nome={p.nome} url={p.foto_url} tam={72} borda />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>{p.nome}</h2>
          <div className="sub">
            {POS_FULL[p.pos]}
            {alt.length ? " · também " + alt.map((x) => POS_FULL[x]).join(", ") : ""}
          </div>
          <div className="sub" style={{ color: "var(--brand-soft)" }}>{p.moedas} pontos na carteira</div>
        </div>
      </div>
      <div className="attrs">
        {ATTRS.map((a) => {
          const v = p[("atr_" + a.k) as "atr_fin"];
          return (
            <div className="attr" key={a.k}>
              <span className="nm">{a.nome}</span>
              <span className="val">{v}</span>
              <span className="bar"><i style={{ width: v + "%" }} /></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Quadra() {
  return (
    <svg viewBox="0 0 100 120" preserveAspectRatio="none" aria-hidden="true">
      <g fill="none" stroke="rgba(255,255,255,.34)" strokeWidth="0.8">
        <rect x="4" y="4" width="92" height="112" rx="3" />
        <line x1="4" y1="60" x2="96" y2="60" />
        <circle cx="50" cy="60" r="13" />
        <path d="M30 4 A20 20 0 0 0 70 4" />
        <path d="M30 116 A20 20 0 0 1 70 116" />
        <rect x="38" y="2" width="24" height="3.5" fill="rgba(255,255,255,.28)" stroke="none" />
        <rect x="38" y="114.5" width="24" height="3.5" fill="rgba(255,255,255,.28)" stroke="none" />
      </g>
    </svg>
  );
}

/** Posição de cada slot na quadra, na ordem da formação. */
export const SLOT_XY: [number, number][] = [[50, 87], [50, 66], [24, 43], [76, 43], [50, 17]];
