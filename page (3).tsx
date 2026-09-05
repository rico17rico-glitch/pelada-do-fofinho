import { notFound } from "next/navigation";
import { lerConfig, lerJogador, lerJogadores, lerRodada } from "@/lib/db";
import { ehAdmin, lerSessao } from "@/lib/session";
import { permissoesDaRodada } from "@/lib/domain";
import Rodada from "./Rodada";

export const dynamic = "force-dynamic";

export default async function PaginaRodada({ params }: { params: { id: string } }) {
  const rodada = await lerRodada(params.id);
  if (!rodada) notFound();

  const [jogadores, cfg] = await Promise.all([lerJogadores(), lerConfig()]);
  const sessao = lerSessao();
  const admin = ehAdmin(sessao);
  const eu = !admin && sessao && sessao.tipo === "jogador" ? await lerJogador(sessao.playerId) : null;
  const perm = permissoesDaRodada(rodada, { admin, jogador: eu });

  /* A hora do servidor vai junto para o cronômetro bater igual em todo aparelho. */
  return (
    <Rodada
      rodada={rodada}
      jogadores={jogadores}
      cfg={cfg}
      perm={perm}
      agoraServidor={new Date().toISOString()}
    />
  );
}
