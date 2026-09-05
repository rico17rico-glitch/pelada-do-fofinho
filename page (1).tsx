import { lerJogadores } from "@/lib/db";
import { ehAdmin, lerSessao } from "@/lib/session";
import Elenco from "./Elenco";

export const dynamic = "force-dynamic";

export default async function PaginaElenco() {
  const admin = ehAdmin(lerSessao());
  const jogadores = await lerJogadores();
  return <Elenco jogadores={jogadores} admin={admin} />;
}
