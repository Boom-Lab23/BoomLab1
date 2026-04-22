# Publicar BoomLab no Google Play Store

Guia completo para publicar as **2 apps BoomLab** (Platform + Comunicação) no Google Play Store.

Stack: **Next.js web hospedado no VPS Hostinger** + **Capacitor wrapper nativo** → AAB para Play Store.

---

## 📋 Pré-requisitos

- [ ] **Conta Google Play Developer** — $25 uma única vez
  - Criar em: https://play.google.com/console/signup
  - Necessita conta Google normal + $25 via cartão de crédito
- [ ] **Android Studio** instalado
  - Download: https://developer.android.com/studio
  - Windows, Mac ou Linux — qualquer um
  - ~3GB de espaço
- [ ] **Java JDK 17+** (o Android Studio traz o seu)
- [ ] **Node.js 20+** (já tens do desenvolvimento)

---

## 🚀 Fluxo de publicação

O projeto tem **2 variantes**:

| Variante | App ID | Nome | Aponta para |
|---|---|---|---|
| `platform` | `agency.boomlab.platform` | BoomLab Platform | servico.boomlab.cloud |
| `comunicacao` | `agency.boomlab.comunicacao` | BoomLab Comunicação | comunicacao.boomlab.cloud |

Cada variante é **uma app separada** no Play Console. São 2 submissões.

---

## 🔨 Passo 1: Gerar keystore de assinatura (uma vez)

Para publicar precisas de um ficheiro `.keystore` que assina as apps. **Guarda este ficheiro com muito cuidado** — se perderes, não podes mais fazer updates à app.

### Gerar keystore

```bash
cd android/app
keytool -genkey -v -keystore boomlab-release-key.keystore -alias boomlab -keyalg RSA -keysize 2048 -validity 10000
```

Vai pedir:
- **Password** → usa algo forte (ex: `BoomLab2026!KeyStore#Secure`)
- **Nome e organização** → `Guilherme Freitas, BoomLab Agency, Tallinn, Estonia, EE`

Resultado: `android/app/boomlab-release-key.keystore`

### ⚠️ Backup do keystore

```bash
# Copia para lugar seguro (fora do repo)
cp android/app/boomlab-release-key.keystore ~/Documents/backups/boomlab-keystore-$(date +%Y%m%d).keystore
```

Guarda também num cofre (Bitwarden, 1Password, etc.) ou numa drive criptografada.

### Configurar gradle para usar o keystore

Edita `android/app/build.gradle` e adiciona antes de `android { ... }`:

```gradle
signingConfigs {
    release {
        storeFile file("boomlab-release-key.keystore")
        storePassword "A_TUA_PASSWORD"
        keyAlias "boomlab"
        keyPassword "A_TUA_PASSWORD"
    }
}

buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

**Nunca commites o `build.gradle` com a password**. Usa `gradle.properties` local:

```properties
# android/gradle.properties (não committado)
BOOMLAB_KEYSTORE_PASSWORD=A_TUA_PASSWORD
```

E em `build.gradle`:
```gradle
storePassword System.getenv("BOOMLAB_KEYSTORE_PASSWORD") ?: project.property("BOOMLAB_KEYSTORE_PASSWORD")
```

---

## 🎯 Passo 2: Build da variante Platform

```bash
# 1. Alterna para variante platform
node docker/switch-variant.mjs platform

# 2. Abre Android Studio (opcional, para verificar)
npx cap open android

# 3. Build AAB (Android App Bundle — formato exigido pelo Play Store)
cd android
./gradlew bundleRelease

# Windows:
# gradlew.bat bundleRelease
```

Resultado: `android/app/build/outputs/bundle/release/app-release.aab`

### Validar o AAB

```bash
# Verifica que está assinado
jarsigner -verify -verbose -certs app/build/outputs/bundle/release/app-release.aab | tail -20
```

Deve aparecer "jar verified".

---

## 🎯 Passo 3: Criar app no Google Play Console (Platform)

1. Vai a https://play.google.com/console
2. Clica em **"Criar app"**
3. Preenche:
   - **Nome**: `BoomLab Platform`
   - **Idioma padrão**: Português (Portugal)
   - **App ou jogo**: App
   - **Grátis ou paga**: Grátis
   - **Declarações**: aceitas as políticas do Google Play

4. Na nova app, menu lateral tem vários passos obrigatórios:

### 4.1. Acesso à app (Setup)
- **Indica se tens secções com login** → Sim
- **Fornece credenciais de teste** para a Google rever a app:
  - Email: `review@boomlab.agency` (cria esta conta no admin)
  - Password: escolhe uma só para review
  - Instruções: "Usar estas credenciais para testar login"

### 4.2. Classificação de conteúdo
- Preenche o questionário. É uma app business, maioria "Não" em conteúdos sensíveis.
- Categoria final: **Classificação todos**

### 4.3. Público-alvo
- **Idade**: 18+
- **Apenas para quem crie conta**: sim

### 4.4. Política de privacidade
- URL: `https://servico.boomlab.cloud/privacy`
- (ou `https://comunicacao.boomlab.cloud/privacy` para a outra app)

### 4.5. Segurança de dados (questionário)
- Recolhes dados? Sim
- Tipos: Nome, email, mensagens, analytics técnicos
- Partilhado com terceiros? Sim (Claude AI, AssemblyAI, Google — para funcionalidade da app)
- Encriptado em trânsito: Sim (HTTPS)
- Utilizadores podem pedir remoção: Sim (via email)

### 4.6. Ficha da loja (Store listing)
- **Título** (max 30): `BoomLab Platform`
- **Descrição curta** (max 80): `Plataforma de gestão de serviço da BoomLab Agency`
- **Descrição longa** (max 4000): usa o texto abaixo
- **Screenshots**: mínimo 2, máximo 8 (1080x1920 ou 1440x2560)
- **Ícone**: 512x512 PNG (usa `public/icons/icon-512.png`)
- **Imagem destacada**: 1024x500 PNG
- **Vídeo promocional**: opcional (YouTube URL)

### 4.7. Descrição longa (texto sugerido para BoomLab Platform)

```
BoomLab Platform — gestão integral de serviço de consultoria comercial.

A plataforma interna da BoomLab Agency para:

📊 DASHBOARDS COMERCIAIS
- KPIs por cliente (Crédito, Seguros, Imobiliário)
- Pipeline com 5 etapas e 3 taxas de conversão distintas
- Métricas por canal de aquisição

📞 ANÁLISE DE CHAMADAS COM IA
- Transcrição automática via AssemblyAI
- Score em 8 dimensões (tom, ritmo, assertividade, empatia...)
- Feedback personalizado com delay de 4h

📅 CALENDÁRIO + FIREFLIES INTEGRATION
- Sincronização automática Google Calendar
- Transcrições Fireflies → sessões criadas automaticamente

👥 CRM LEADS POR COMERCIAL
- Cada comercial tem a sua folha
- Detecção automática de duplicados
- 6 campos de contacto por lead

📄 BASE DE CONHECIMENTO IA
- Scripts, SOPs, frameworks
- IA deteta automaticamente mercado aplicável
- Usado como contexto para análise de chamadas

💬 MENSAGENS INTERNAS + CLIENTES
- Canal por cliente
- Sub-canais por área
- Anexos até 10MB

🔐 MULTI-UTILIZADOR COM PERMISSÕES
- Admin, Gestor, Consultor, Cliente
- Workspaces atribuíveis por cliente
- RGPD compliant

Acesso restrito a colaboradores da BoomLab Agency e clientes autorizados.
```

### 4.8. Upload do AAB
- Vai a **"Teste interno"** (mais rápido para começar)
- Upload do `app-release.aab`
- Nome da versão: `1.0.0 - BoomLab Platform launch`
- Notas: `Primeira versão pública`
- Review → submit

### 4.9. Publicar em produção
Quando o teste interno estiver OK, promove para **produção**:
- Release → Produção → Criar nova release → Copiar do teste interno
- Rollout: 100% gradual ou diretamente 100%

---

## 🎯 Passo 4: Repetir para Comunicação

```bash
# 1. Alterna para variante comunicacao
node docker/switch-variant.mjs comunicacao

# 2. Build
cd android
./gradlew bundleRelease
# gera android/app/build/outputs/bundle/release/app-release.aab (OVERRIDE do anterior)

# ⚠️ Copia o .aab antes de rebuild!
cp app/build/outputs/bundle/release/app-release.aab ../builds/platform-v1.0.0.aab
# ^ o primeiro. Depois:
cp app/build/outputs/bundle/release/app-release.aab ../builds/comunicacao-v1.0.0.aab
```

No Play Console, cria **nova app separada** chamada **BoomLab Comunicação**:
- App ID diferente: `agency.boomlab.comunicacao`
- Texto e descrição adaptados (focada em clientes)
- Upload do AAB correspondente

### Descrição longa sugerida (Comunicação)

```
BoomLab Comunicação — o teu canal direto com a BoomLab Agency.

A app oficial para clientes BoomLab acompanharem o seu projeto de consultoria comercial.

💬 MENSAGENS DIRETAS
- Canal privado connosco 24/7
- Anexa ficheiros, PDFs, imagens
- Histórico completo sempre acessível

📊 DASHBOARD DO TEU PROJETO
- Métricas comerciais em tempo real
- KPIs de crescimento do teu negócio
- Leads e conversões organizadas

📞 GRAVAÇÕES DAS NOSSAS REUNIÕES
- Revê as nossas sessões quando quiseres
- Transcrições completas
- Plano de ação em cada reunião

🔐 ACESSO PRIVADO E SEGURO
- Só tu vês o teu workspace
- HTTPS end-to-end
- RGPD compliant

Ao instalar esta app terás acesso imediato a:
- Gestão Comercial
- Consultoria Comercial
- Consultoria de Vendas
- Processos de RH
- BoomClub (eventos exclusivos)

Precisas de credenciais BoomLab para entrar. Se ainda não tens, clica em "Criar conta" no ecrã de login — ativamos o teu acesso em 1-2 dias úteis.

A BoomLab Agency é uma empresa registada em Tallinn, Estónia (Boomlab Agency OÜ).
```

---

## 📸 Assets que vais precisar

Para cada app vais precisar de:

### Ícone
- **512x512 PNG**: usa `public/icons/icon-512.png` (Platform) ou `public/icons/comm-512.png` (Comunicação)

### Imagem destacada
- **1024x500 PNG** — gerar com mockup da app sobre fundo BoomLab
- Podes usar Canva ou Figma

### Screenshots (mínimo 2)
- Abre a app no Android Studio Emulator (ou no teu telemóvel)
- Faz screenshots das páginas mais importantes:
  - Login
  - Workspace do cliente
  - Mensagens
  - Dashboard
- **Resolução**: 1080x1920 (portrait) ou 1440x2560 (mais HD)

### Screenshots em ambiente cuidado (dica)
- Tira screenshots com a app **cheia de dados realistas** (não conta vazia)
- Evita mostrar emails reais de clientes (blur ou usar dados fake)

---

## 🎬 Publicar com 0 dores (checklist)

- [ ] Keystore gerado e guardado em backup
- [ ] `build.gradle` configurado com signing
- [ ] `node docker/switch-variant.mjs platform` executado
- [ ] AAB gerado (app-release.aab)
- [ ] AAB copiado para `builds/platform-v1.0.0.aab`
- [ ] Repetir para comunicacao
- [ ] Conta Play Developer criada
- [ ] App Platform criada no Play Console
- [ ] App Comunicação criada no Play Console
- [ ] Política de privacidade preenchida (URL)
- [ ] Questionário de segurança de dados preenchido
- [ ] Ícones + screenshots + descrições carregados
- [ ] AAB upload + release interno
- [ ] Teste numa conta real
- [ ] Promover para produção

**Tempo estimado**: 2-4 horas por app (primeira vez). Depois é só build + upload.

---

## 🔄 Fazer updates à app depois de publicada

Quando fizeres mudanças no código Next.js:
- **Nada a fazer para as apps** — elas carregam o site remoto, que já foi atualizado via `git push` + deploy VPS.

Só precisas de republicar nas stores quando:
- Mudas o nome/ícone/descrição da app
- Adicionas novas features nativas (push notifications, biometria, etc.)

Para republicar:
1. Incrementa `versionCode` + `versionName` em `android/app/build.gradle`
2. `node docker/switch-variant.mjs <platform|comunicacao>`
3. `cd android && ./gradlew bundleRelease`
4. Upload do novo `.aab` no Play Console
5. Release → Produção → Criar nova release

---

## 🆘 Troubleshooting

### Build falha: "SDK not found"
Abre Android Studio, vai a **Settings → Android SDK** e instala:
- Android SDK 34 (Android 14)
- Android SDK Build-Tools 34.0.0
- Android SDK Platform-Tools

### Play Console: "The uploaded APK/AAB is not signed with the upload certificate"
Significa que o `.aab` não foi assinado corretamente. Verifica que o `build.gradle` tem `signingConfig signingConfigs.release` dentro de `buildTypes.release`.

### Play Console rejeita: "App pode não funcionar corretamente"
Quase sempre é política de privacidade. Verifica que a URL está acessível em https.

### App no telemóvel mostra página em branco
Verifica que o `capacitor.config.ts` aponta para `https://servico.boomlab.cloud` (ou comunicação) e que a URL responde com `HTTP/2 200`.

---

## 💡 Dicas extras

### Internal testing primeiro
Usa sempre o track **"Teste interno"** antes de produção. Podes convidar 100 testers (por email) — inclui a tua equipa BoomLab e 2-3 clientes beta. O release é quase instantâneo (sem review Google).

### Closed testing
Para teste com ~1000 pessoas antes de lançar publicamente. Requires review mas menos exigente.

### Open testing
Aberto ao público mas ainda marcado como beta. Review completo.

### Produção
O update final. Se está tudo OK nos anteriores, produção aprova rápido (~24-48h).

---

## Boomlab + stores — cheat sheet final

```bash
# Variante platform (app da equipa)
node docker/switch-variant.mjs platform
cd android && ./gradlew bundleRelease
# ^ AAB em android/app/build/outputs/bundle/release/app-release.aab

# Variante comunicacao (app dos clientes)
node docker/switch-variant.mjs comunicacao
cd android && ./gradlew bundleRelease
# ^ AAB em android/app/build/outputs/bundle/release/app-release.aab (override)

# Importante: copia o AAB ANTES de fazer build da outra variante
mkdir -p builds
cp android/app/build/outputs/bundle/release/app-release.aab builds/$(date +%Y%m%d)-platform.aab
# ou
cp android/app/build/outputs/bundle/release/app-release.aab builds/$(date +%Y%m%d)-comunicacao.aab
```

Quando tudo estiver funcional, diz-me e faço-te os screenshots e imagens destacadas prontas a carregar no Play Console.
