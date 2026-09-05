"use client";

import { useRef, useState, useTransition } from "react";
import { removerFoto, salvarFoto } from "@/lib/actions";
import { Confirmar, Toast, useToast } from "@/components/ui";

/** Recorta no centro, deixa quadrada e reduz para 400px antes de enviar. */
function prepararImagem(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const lado = Math.min(img.width, img.height);
      const tela = document.createElement("canvas");
      tela.width = 400;
      tela.height = 400;
      const ctx = tela.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); return reject(new Error("Navegador não deu conta da imagem.")); }
      ctx.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, 400, 400);
      URL.revokeObjectURL(url);
      resolve(tela.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não consegui ler essa imagem.")); };
    img.src = url;
  });
}

export default function TrocarFoto({ playerId, temFoto }: { playerId: string; temFoto: boolean }) {
  const [pendente, iniciar] = useTransition();
  const { msg, avisar } = useToast();
  const [removendo, setRemovendo] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (input.current) input.current.value = "";
    if (!file) return;
    if (!/^image\//.test(file.type)) return avisar("Escolha um arquivo de imagem.");

    prepararImagem(file)
      .then((base64) =>
        iniciar(async () => {
          const r = await salvarFoto(playerId, base64);
          avisar(r.ok ? r.msg || "Foto atualizada." : r.erro || "Não deu para enviar.");
        })
      )
      .catch((err) => avisar(err.message || "Não consegui ler essa imagem."));
  }

  return (
    <>
      <input
        ref={input} type="file" accept="image/*" hidden
        onChange={escolher} aria-label="Escolher foto"
      />
      <button className="btn sm" disabled={pendente} onClick={() => input.current?.click()}>
        {pendente ? "Enviando…" : temFoto ? "Trocar foto" : "Colocar foto"}
      </button>
      {temFoto ? (
        <button className="btn sm ghost" disabled={pendente} onClick={() => setRemovendo(true)}>
          Tirar foto
        </button>
      ) : null}

      {removendo ? (
        <Confirmar
          titulo="Tirar a foto?"
          texto="O card volta a mostrar as iniciais. Dá para colocar outra depois."
          labelOk="Tirar"
          onOk={() => {
            setRemovendo(false);
            iniciar(async () => {
              const r = await removerFoto(playerId);
              avisar(r.ok ? r.msg || "Foto removida." : r.erro || "Não deu certo.");
            });
          }}
          onCancelar={() => setRemovendo(false)}
        />
      ) : null}

      <Toast msg={msg} />
    </>
  );
}
