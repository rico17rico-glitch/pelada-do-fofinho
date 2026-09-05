import { notFound } from "next/navigation";
import { lerConfig, lerJogadores, lerRodada } from "@/lib/db";
import { ehAdmin, lerSessao } from "@/lib/session";
import Rodada from "./Rodada";

export const dynamic = "force-dynamic";

export default async function PaginaRodada({ params }: { params: { id: string } }) {
  const rodada = await lerRodada(params.id);
  if (!rodada) notFound();

  const [jogadores, cfg] = await Promise.all([lerJogadores(), lerConfig()]);
  const admin = ehAdmin(lerSessao());

  /* A hora do servidor vai junto para o cronômetro bater igual em todo aparelho. */
  return (
    <Rodada
      rodada={rodada}
      jogadores={jogadores}
      cfg={cfg}
      admin={admin}
      agoraServidor={new Date().toISOString()}
    />
  );
}
