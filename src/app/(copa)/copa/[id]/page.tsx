import { notFound } from "next/navigation";
import { lerConfig, lerCopa, lerJogador, lerJogadores } from "@/lib/db";
import { ehAdmin, lerSessao } from "@/lib/session";
import Copa from "./Copa";

export const dynamic = "force-dynamic";

export default async function PaginaCopa({ params }: { params: { id: string } }) {
  const copa = await lerCopa(params.id);
  if (!copa) notFound();

  const [jogadores, cfg] = await Promise.all([lerJogadores(), lerConfig()]);
  const sessao = lerSessao();
  const admin = ehAdmin(sessao);
  const eu = !admin && sessao && sessao.tipo === "jogador" ? await lerJogador(sessao.playerId) : null;

  const organizador = admin || !!eu?.organizador;
  const capitao = !!eu && (copa.times || []).some((t) => t.capitao === eu.id);

  return (
    <Copa
      copa={copa}
      jogadores={jogadores}
      cfg={cfg}
      meuId={eu?.id || null}
      organizador={organizador}
      podeApitar={organizador || capitao}
      agoraServidor={new Date().toISOString()}
    />
  );
}
