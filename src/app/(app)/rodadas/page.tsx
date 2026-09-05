import { lerConfig, lerRodadas } from "@/lib/db";
import { ehAdmin, lerSessao } from "@/lib/session";
import ListaRodadas from "./ListaRodadas";

export const dynamic = "force-dynamic";

export default async function PaginaRodadas() {
  const admin = ehAdmin(lerSessao());
  const [rodadas, cfg] = await Promise.all([lerRodadas(), lerConfig()]);
  return <ListaRodadas rodadas={rodadas} admin={admin} cfg={cfg} />;
}
