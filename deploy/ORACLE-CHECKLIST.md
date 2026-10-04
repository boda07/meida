# Checklist — Criar a conta Oracle Cloud (Always Free)

Passo a passo, com todos os campos. Tempo estimado: **10–15 min** de registo +
**5–15 min** até a conta ficar ativa. Usa uma **ligação normal** (evita VPN — a
Oracle marca VPN como suspeita e pode bloquear).

> Dica: podes ir preenchendo e clicar **"Verify my email"** / **"Verify my phone
> number"** nos códigos que recebes. Não feches a página até acabar.

---

## 1. Abrir o registo

- [ ] Vai a <https://signup.oraclecloud.com> (ou oracle.com/cloud/free → *Start for free*).

## 2. Dados iniciais

- [ ] **Country / Region**: `Portugal`
- [ ] **First name** / **Last name**: o teu nome (igual ao do cartão)
- [ ] **Email**: o teu email (recebes aqui os códigos e os avisos)
- [ ] Clica **Verify my email** → mete o **código** que chegou ao email.

## 3. Conta e palavra-passe

- [ ] **Password**: 8–30 caracteres, com **1 maiúscula, 1 minúscula, 1 número e
      1 símbolo**.
- [ ] **Cloud Account Name** (a tua "tenancy"): algo único, só minúsculas/letras,
      ex.: `meida-boda` ou `boda-meida`. **Não pode ser mudado depois.**

## 4. Home Region (região principal)

- [ ] Escolhe a região mais perto: **Madrid (Spain Central)** ou **Frankfurt
      (Germany Central)**.
- ⚠️ **Não pode ser alterada depois.** O *Always Free* fica sempre nesta região.
- Nota: as máquinas ARM (Ampere A1) às vezes estão esgotadas numa região —
      nesse caso mudas de **Availability Domain** ao criar a VM, ou tentas mais
      tarde.

## 5. Telemóvel

- [ ] **Mobile number**: `+351` e o teu número.
- [ ] Clica **Verify my phone number** → mete o **código** do SMS.

## 6. Cartão (verificação de identidade)

- [ ] **Add payment verification method** → **Credit Card**.
- [ ] Preenche: número, validade, CVV e **nome do titular**.
- [ ] **Billing address**: tem de bater certo com a morada do cartão (rua,
      código postal, cidade, país).
- [ ] Aceita o contrato (*Cloud Services Agreement*) → **Start my free trial**.

> **Santander débito**: antes disto, garante na app/Santander Online que o cartão
> tem **compras online** e **pagamentos internacionais** ativos.
> A Oracle faz uma **retenção temporária** (~1 €) que o banco devolve em 3–5 dias.
> **Não é cobrado nada** enquanto ficares no *Always Free*.

## 7. Esperar a ativação

- [ ] Recebes 2 emails: *welcome* e *account activated* (5–15 min, às vezes mais).
- [ ] Entra em <https://cloud.oracle.com> com o **email** e a **password**.
      (A primeira vez pode pedir o *Cloud Account Name* / domínio.)

---

## Logo a seguir (resumo — detalhes em `deploy/README.md`)

- [ ] **Menu → Compute → Instances → Create instance**
  - Image: **Ubuntu 24.04**
  - Shape: **Ampere → VM.Standard.A1.Flex** → **1 OCPU / 6 GB**
  - SSH key: gerar e **descarregar a privada**
- [ ] **Networking → VCN → Security Lists → Default → Add Ingress Rules**:
  - `0.0.0.0/0` TCP **80** e `0.0.0.0/0` TCP **443**
- [ ] Anota o **Public IP**.
- [ ] SSH: `ssh -i chave.key ubuntu@<IP>`
- [ ] Segue `deploy/README.md` a partir do ponto 4 (código + `bootstrap.sh`).

---

## Se algo correr mal

| Problema | O que fazer |
|---|---|
| Cartão recusado | Ativa compras online + internacionais; tenta outra vez. Se insistir, liga ao Santander a autorizar a retenção internacional, ou usa um cartão de crédito. |
| Não recebes o email de ativação | Verifica o **spam**. Pode demorar. |
| "Out of capacity" ao criar a VM ARM | Muda a **Availability Domain**; se falhar em todas, muda de região na criação ou tenta noutro dia. |
| Conta bloqueada / pedido de verificação extra | A Oracle às vezes pede documento de identidade — responde pelo email/suporte. |
| Não podes ter 2 contas | Só é permitida **1 conta por pessoa**. Não tentes criar várias. |
