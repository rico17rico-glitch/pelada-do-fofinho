import { redirect } from "next/navigation";
import { lerConfig } from "@/lib/db";
import { ehAdmin, lerSessao } from "@/lib/session";
import Ajustes from "./Ajustes";

export const dynamic = "force-dynamic";

export default async function PaginaAjustes() {
  if (!ehAdmin(lerSessao())) redirect("/ranking");
  const cfg = await lerConfig();
  return <Ajustes cfg={cfg} />;
}
