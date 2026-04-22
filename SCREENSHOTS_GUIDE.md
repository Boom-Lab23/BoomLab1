# Guia de Screenshots para Play Store

## Especificacoes

**Tamanho recomendado:** 1080x1920 (portrait) ou 1080x2400
**Formato:** PNG ou JPEG (PNG preferido)
**Numero:** minimo 2, maximo 8 por app
**Ratio:** entre 16:9 e 9:16

---

## Metodo recomendado: Chrome DevTools (sem telemovel)

1. Abre **Chrome** no computador
2. Vai a `https://servico.boomlab.cloud` (ou `comunicacao.boomlab.cloud` para a outra app)
3. Faz login
4. Pressiona **F12** (ou Ctrl+Shift+I) para abrir DevTools
5. Clica no icone de **telemovel/tablet** no canto superior esquerdo do DevTools (ou Ctrl+Shift+M)
6. No dropdown de dispositivos escolhe: **Pixel 7** (1080x2400) ou **iPhone 14 Pro Max**
7. Navega para a pagina que queres capturar
8. Clica nos **3 pontos** no topo do DevTools emulator → **Capture screenshot** (ou **Capture full size screenshot**)
9. Guarda com nome descritivo

---

## Paginas a capturar (sugestao: 4-6 por app)

### BoomLab Platform (servico.boomlab.cloud)

1. **Dashboard** (`/`) — visao geral com KPIs, reunioes do dia
2. **Clientes** (`/clients`) — lista com filtros por pilar
3. **Detalhe Cliente** (`/clients/[id]`) — tabs com Info, Timeline, Documentos
4. **Sessoes** (`/sessions`) — calendario/board com status
5. **Detalhe Sessao** (`/sessions/[id]`) — resumo Fireflies + action items
6. **Gravacoes** (`/recordings`) — lista com analise IA + score
7. **Mensagens** (`/messaging`) — chat tipo Slack por canal
8. **Dashboards** (`/dashboards`) — dashboards por cliente

**Recomendacao:** Dashboard + Clientes + Sessao + Gravacao com analise IA

### BoomLab Comunicacao (comunicacao.boomlab.cloud)

1. **Dashboard do cliente** — vista filtrada so do cliente em causa
2. **Detalhe Sessao** — com resumo e action items
3. **Dashboards** — dashboards partilhados com o cliente
4. **Mensagens** — canal com a equipa BoomLab

**Recomendacao:** Dashboard + Sessao + Dashboard + Mensagens

---

## Onde guardar

```
Desktop/play-store-assets/
├── platform/
│   ├── icon-512.png
│   ├── feature-graphic-1024x500.png
│   ├── screenshot-1-dashboard.png        <-- NOVO
│   ├── screenshot-2-clients.png           <-- NOVO
│   ├── screenshot-3-session.png           <-- NOVO
│   └── screenshot-4-recording-ai.png      <-- NOVO
└── comunicacao/
    ├── icon-512.png
    ├── feature-graphic-1024x500.png
    ├── screenshot-1-dashboard.png        <-- NOVO
    ├── screenshot-2-session.png           <-- NOVO
    ├── screenshot-3-dashboard-view.png    <-- NOVO
    └── screenshot-4-messaging.png         <-- NOVO
```

---

## Dicas

- **Usa dados reais** (nao "Lorem ipsum") — Play Store pode rejeitar mocks
- **Nao mostres emails/passwords** sensiveis de clientes
- **Captura a pagina completa** (scroll all) se for longa — DevTools tem essa opcao
- **Portrait > landscape** para Play Store (apps moveis sao portrait por default)
- **Mesmo aspect ratio** para todos os screenshots da mesma app (fica mais pro)

---

## Alternativa: capturar no telemovel real

Se preferires:
1. Abre Chrome ou instala a PWA (`/install`) no teu telemovel
2. Navega para as paginas
3. Captura screenshots (Power + Volume Down no Android)
4. Transfere para o computador (USB, AirDrop, ou email)

Vantagem: mais autentico. Desvantagem: resolucao depende do telemovel.

---

## Apos capturares

Diz-me quando tiveres os screenshots guardados e eu indico o passo seguinte (upload Play Console).
