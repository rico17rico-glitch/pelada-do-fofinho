# Pelada do Fofinho

Site de gestão da pelada: ranking com overall de 0 a 100, sorteio de times por posição
de futsal, controle de rodadas e loja onde o jogador troca pontos por atributo.

Feito em **Next.js** (o site) + **Supabase** (o banco de dados). As duas plataformas
têm plano gratuito de sobra para uma pelada — o custo é **R$ 0**.

---

## Como as regras funcionam

Existem dois números diferentes, de propósito:

| | O que é | Como muda |
|---|---|---|
| **Overall (0–100)** | Média dos 4 critérios: Finalização, Visão de jogo, Defesa, Intensidade | Só sobe comprando na Loja |
| **Pontos** | A moeda da loja | Ganhos ao fechar a rodada, gastos na loja |

No cadastro você escolhe a nota base (60, 65, 70, 75 ou 80) e os quatro critérios começam
nela. Cada +1 num critério vale +0,25 no overall.

**Ao fechar a rodada:**

- Time com **mais vitórias** no dia: **50 pontos** para cada jogador dele
- Cada gol: **5 pontos**
- Cada assistência: **2 pontos**

Gols e assistências somam todos os confrontos do dia. Desempate do campeão: vitórias →
pontos (3/1/0) → saldo de gols → gols marcados. Dá para forçar o campeão manualmente.

**Preço na loja** (custo de +1 num critério, conforme o valor atual):

| Critério está em | Custo |
|---|---|
| 0–69 | 60 pts |
| 70–79 | 120 pts |
| 80–89 | 250 pts |
| 90–99 | 500 pts |

Tudo isso é editável na aba **Ajustes**, sem mexer em código.

**Sorteio:** distribui posição por posição começando pelas mais escassas (goleiro, fixo,
pivô, depois as alas), o time mais fraco escolhe primeiro, e no fim uma busca local troca
jogadores de mesma posição até equilibrar. Com 15 jogadores em 3 times a diferença fica
em torno de 1 ponto de média por time.

---

## Colocar no ar (uma vez só)

### 1. Criar o banco no Supabase

1. Entre em **supabase.com** e crie uma conta (dá para entrar com o GitHub ou o Google).
2. Clique em **New project**. Escolha um nome (ex.: `pelada-do-fofinho`), defina uma
   senha de banco (guarde num lugar seguro) e a região **South America (São Paulo)**.
3. Espere uns 2 minutos até o projeto ficar pronto.
4. No menu da esquerda, abra **SQL Editor** → **New query**.
5. Abra o arquivo `supabase/schema.sql` deste projeto, copie **tudo**, cole ali e clique
   em **Run**. Deve aparecer "Success".
6. Vá em **Project Settings → API** e anote dois valores:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - **service_role** em Project API keys — clique em *Reveal*. **Essa chave é secreta**,
     não mande para ninguém e não coloque em print.

### 2. Publicar o site na Vercel

1. Suba esta pasta para um repositório no **GitHub** (pode ser privado).
2. Entre em **vercel.com**, faça login com o GitHub e clique em **Add New → Project**.
3. Escolha o repositório. A Vercel reconhece Next.js sozinha, não precisa mudar nada.
4. Antes de clicar em Deploy, abra **Environment Variables** e cadastre três:

   | Nome | Valor |
   |---|---|
   | `SUPABASE_URL` | a Project URL do passo 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | a chave service_role do passo 1 |
   | `SESSION_SECRET` | qualquer texto longo e aleatório (30+ caracteres) |

5. Clique em **Deploy**. Em uns 2 minutos o site está no ar num endereço tipo
   `pelada-do-fofinho.vercel.app`.

### 3. Primeiro acesso

1. Abra o site, clique em **Sou o mestre da pelada** e entre com o PIN **1234**.
2. Vá em **Ajustes** e **troque o PIN do mestre na hora** — ele é a única chave do painel.
3. Vá em **Elenco → Novo jogador** e cadastre a galera. Cada mensalista recebe um PIN de
   4 dígitos, que aparece só para você na coluna PIN — é esse número que você manda para
   a pessoa no privado.
4. Mande o link do site no grupo. Cada um entra escolhendo o próprio nome e digitando o PIN.

---

## Rodar no seu computador (opcional)

Precisa do Node.js 18 ou mais novo instalado.

```bash
npm install
cp .env.example .env.local   # preencha com os dados do Supabase
npm run dev
```

O site abre em `http://localhost:3000`.

---

## Como o projeto está organizado

```
supabase/schema.sql          estrutura do banco (rode uma vez no Supabase)
src/lib/domain.ts            TODAS as regras da pelada, sem banco e sem tela
src/lib/db.ts                leitura do Supabase
src/lib/session.ts           login por cookie assinado
src/lib/actions.ts           tudo que grava no banco, com checagem de permissão
src/app/page.tsx             tela de entrada (escudo + nome e PIN)
src/app/(app)/…              ranking, elenco, rodadas, loja, ajustes
src/components/              peças reaproveitadas (card do jogador, quadra, modal…)
```

Se um dia você quiser mudar uma regra, `src/lib/domain.ts` é o único arquivo que importa.

---

## Sobre segurança

- O navegador **nunca** fala direto com o Supabase. Toda leitura e gravação passa pelo
  servidor do Next.js, que usa a chave `service_role`. As tabelas estão com RLS ligado e
  sem nenhuma política, ou seja, acesso público zero.
- O login é um cookie `httpOnly` assinado com a `SESSION_SECRET`. Sem esse segredo
  ninguém consegue forjar uma sessão.
- O PIN do jogador fica guardado como texto simples, porque o mestre precisa conseguir
  ler e avisar quem esqueceu. É um código de 4 dígitos de um site de pelada —
  **ninguém deve reaproveitar um PIN que usa em outro lugar**.
