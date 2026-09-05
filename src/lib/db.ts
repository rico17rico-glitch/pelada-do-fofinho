import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Config, Player, Round } from "./domain";

/* O site conversa com o Supabase só pelo servidor, com a chave service_role.
   Nada disso chega ao navegador. */
let cliente: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (cliente) return cliente;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltam as variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY. " +
        "Confira o arquivo .env.local (local) ou as Environment Variables na Vercel."
    );
  }
  cliente = createClient(url, key, { auth: { persistSession: false } });
  return cliente;
}

export const CONFIG_PADRAO: Config = {
  pontos_vitoria: 50,
  pontos_gol: 5,
  pontos_assist: 2,
  faixas: [
    { ate: 69, preco: 60 },
    { ate: 79, preco: 120 },
    { ate: 89, preco: 250 },
    { ate: 99, preco: 500 },
  ],
  admin_pin: "1234",
  qtd_times: 3,
  regra_partida: "7 minutos ou 2 gols",
  nome_pelada: "Pelada do Fofinho",
  duracao_min: 7,
  gols_limite: 2,
};

export async function lerConfig(): Promise<Config> {
  const { data, error } = await db().from("config").select("*").eq("id", 1).maybeSingle();
  if (error || !data) return CONFIG_PADRAO;
  return { ...CONFIG_PADRAO, ...data } as Config;
}

export async function lerJogadores(): Promise<Player[]> {
  const { data, error } = await db().from("players").select("*").order("nome");
  if (error || !data) return [];
  return data as Player[];
}

export async function lerJogador(id: string): Promise<Player | null> {
  const { data } = await db().from("players").select("*").eq("id", id).maybeSingle();
  return (data as Player) || null;
}

export async function lerRodadas(): Promise<Round[]> {
  const { data, error } = await db().from("rounds").select("*").order("data", { ascending: false });
  if (error || !data) return [];
  return data as Round[];
}

export async function lerRodada(id: string): Promise<Round | null> {
  const { data } = await db().from("rounds").select("*").eq("id", id).maybeSingle();
  return (data as Round) || null;
}
