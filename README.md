# PCPE 2027 — Planner de Estudos

Site estático e responsivo para acompanhar o estudo para **Agente de Polícia** e **Escrivão de Polícia** da PCPE, conforme o Edital nº 1 – PCPE, de 2 de outubro de 2026.

## O que já está pronto

- cronograma de 22 semanas, de 05/10/2026 a 07/03/2027;
- rotina fixa de segunda a sexta (09h–11h30) e fins de semana (~6h líquidas/dia);
- dois últimos ciclos exclusivamente de revisão e simulados;
- revisão automática D+7 e D+30 após marcar um tópico como concluído;
- checklist completo do conteúdo programático;
- seletor Agente / Escrivão — o plano comum é mantido e apenas a diferença de cargo é trocada;
- **Agente:** Contabilidade Geral;
- **Escrivão:** Arquivologia + rotina de digitação;
- cronômetro com salvamento de tempo, páginas, questões, acertos e erros;
- histórico de estudo;
- 30 questões autorais de fixação por matéria, no formato A–E, com comentário liberado apenas após a resposta;
- painel de acurácia, pontos fracos e progresso por matéria;
- registro de simulados, objetiva, discursiva, tempo e pontos fracos;
- tema de redação de segurança pública em cada domingo;
- backup e restauração via JSON;
- funcionamento offline básico via service worker.

## Observação sobre questões oficiais Cebraspe

O projeto **não reproduz em massa o texto integral de questões oficiais recentes**, para evitar redistribuição indevida de material protegido. A página **Questões** inclui treino autoral de 30 itens por matéria e links para cadernos oficiais do Cebraspe. Se você possuir um banco de questões licenciado ou PDFs que possam ser utilizados, ele pode ser integrado ao formato do arquivo `data.js`.

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub, por exemplo `pcpe-planner`.
2. Envie todos os arquivos desta pasta para a raiz do repositório, mantendo a pasta `assets/`.
3. No GitHub, abra **Settings → Pages**.
4. Em **Build and deployment**, selecione **Deploy from a branch**.
5. Escolha a branch `main` e a pasta `/ (root)` e salve.
6. O GitHub fornecerá a URL pública do site.

Não há necessidade de plugin, banco de dados ou servidor. Os dados pessoais de estudo ficam apenas no `localStorage` do navegador. Use **Configurações → Exportar JSON** para backups periódicos.

## Arquivos

- `index.html` — estrutura da aplicação;
- `styles.css` — design responsivo;
- `data.js` — edital, cronograma e banco autoral de treino;
- `app.js` — lógica do sistema e persistência local;
- `manifest.webmanifest` — instalação como web app;
- `sw.js` — cache offline básico;
- `assets/edital-pcpe-2026.pdf` — edital usado como base.

## Base de planejamento

A objetiva de Agente e Escrivão tem 60 questões: 20 de Noções de Direito e 40 de Conhecimentos Específicos. A prova discursiva é uma redação de tema atual e relevante na área de segurança pública, de até 30 linhas. O site foi construído para a data prevista de 07/03/2027.

## Publicação

Este repositório contém o PCPE Planner. Para publicar no GitHub Pages, use Settings → Pages → Deploy from a branch → main → /(root).
