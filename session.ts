import crypto from "node:crypto";
import { cookies } from "next/headers";

/* Sessão simples e assinada: o cookie carrega quem é a pessoa e uma
   assinatura HMAC. Sem a SESSION_SECRET ninguém consegue forjar um cookie. */

export type Sessao = { tipo: "admin" } | { tipo: "jogador"; playerId: string };

const COOKIE = "pf_sessao";
const DIAS = 60;

function segredo(): string {
  return process.env.SESSION_SECRET || "pelada-do-fofinho-segredo-de-desenvolvimento";
}

export function assinar(payload: Sessao): string {
  const corpo = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", segredo()).update(corpo).digest("base64url");
  return `${corpo}.${mac}`;
}

export function conferir(token: string | undefined): Sessao | null {
  if (!token || !token.includes(".")) return null;
  const [corpo, mac] = token.split(".");
  const esperado = crypto.createHmac("sha256", segredo()).update(corpo).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(corpo, "base64url").toString()) as Sessao;
  } catch {
    return null;
  }
}

export function lerSessao(): Sessao | null {
  return conferir(cookies().get(COOKIE)?.value);
}

export function gravarSessao(s: Sessao): void {
  cookies().set(COOKIE, assinar(s), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * DIAS,
  });
}

export function limparSessao(): void {
  cookies().delete(COOKIE);
}

export const ehAdmin = (s: Sessao | null) => !!s && s.tipo === "admin";
