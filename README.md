# loopd (review.albuns) 🎧

Um aplicativo web dinâmico para buscar, avaliar e gerenciar suas reviews de álbuns musicais. O projeto integra com a API do Spotify para buscar automaticamente metadados completos de qualquer álbum, enquanto gerencia os dados do usuário com privacidade total, salvando o histórico localmente no navegador.

## ✨ Funcionalidades

- **Integração com Spotify**: Cole o link de um álbum do Spotify e o sistema busca automaticamente a capa, nome, artista, faixas e durações.
- **Avaliação Detalhada**: Avalie o álbum como um todo (de 1 a 9 estrelas) e também dê notas individuais (com suporte a meia estrela) para cada faixa.
- **Faixas Favoritas**: Marque as melhores faixas de cada álbum com um ícone de coroa (👑).
- **Interface Dinâmica e Fluida**: O plano de fundo (background) da aplicação se adapta automaticamente às cores da capa do álbum que está sendo avaliado no momento.
- **Dashboard e Estatísticas**: Uma aba dedicada que mostra a sua distribuição de notas, o artista mais ouvido, o total de músicas avaliadas e o seu top 10 álbuns baseado nas suas notas.
- **Biblioteca Interativa**: Visualize todas as suas reviews passadas em formato de grid, podendo ordená-las por data, nota, duração ou quantidade de faixas.
- **Totalmente Local e Privado**: O seu histórico é salvo via `LocalStorage` diretamente no seu navegador. Nenhuma conta é necessária e nenhum dado de usuário vai para bancos de dados externos.
- **Importação e Exportação**: Exporte reviews individuais em `.txt` ou faça backups completos da sua biblioteca em `.json`.

## 🛠 Tecnologias Utilizadas

- **Frontend**: HTML5, CSS3 Vanilla (sem frameworks, com uso avançado de variáveis CSS) e JavaScript (Vanilla).
- **Backend (API)**: Serverless Functions da Vercel (Node.js) para se comunicar com a API do Spotify e ocultar as credenciais (Client ID e Secret).
- **Hospedagem**: Vercel.

## 🚀 Como rodar o projeto localmente

### 1. Pré-requisitos
- Ter o [Node.js](https://nodejs.org/) instalado no seu computador.
- Ter uma conta de desenvolvedor no Spotify (para gerar as chaves da API).

### 2. Configurando o Spotify API
1. Acesse o [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Crie um novo aplicativo ("Create App").
3. Após criar o app, acesse as configurações (Settings) e copie o **Client ID** e o **Client Secret**.

### 3. Instalação e Configuração

Clone ou baixe este repositório e abra o terminal na pasta raiz do projeto.

Crie um arquivo `.env.local` na raiz do projeto e insira as suas chaves do Spotify no formato abaixo:
```env
CLIENT_ID="seu_client_id_aqui"
CLIENT_SECRET="seu_client_secret_aqui"
```

### 4. Rodando o servidor local
Como o projeto utiliza as Serverless Functions da Vercel para a API, você precisará da CLI da Vercel instalada para rodar corretamente.
No terminal, execute:
```bash
npx vercel dev
```
O Vercel CLI fará o processo de vincular a sua pasta a um projeto da sua conta da Vercel e iniciará um servidor local. Após o processo, acesse `http://localhost:3000` (ou a porta indicada no terminal) pelo seu navegador.

## 📦 Deploy (Publicação)
Se desejar colocar sua própria versão do projeto no ar:
1. Conecte este repositório ao [Vercel](https://vercel.com).
2. Adicione as variáveis de ambiente (`CLIENT_ID` e `CLIENT_SECRET`) na aba "Environment Variables" das configurações do seu projeto na Vercel antes do primeiro deploy.
3. Clique em Deploy!

---
*Desenvolvido para amantes de música que desejam catalogar e pontuar as suas experiências auditivas de forma bonita e simples.*
