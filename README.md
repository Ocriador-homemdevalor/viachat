# Viachat

Um organizador pessoal em português para rotina, finanças e metas. Responsivo para celular e computador, com tabelas editáveis, gráficos de progresso e backup JSON.

## O que você pode fazer

- Criar, editar e excluir atividades, com data, horário, área da vida, prioridade e status.
- Registrar entradas e despesas, editar os campos diretamente e acompanhar o saldo por mês.
- Criar metas em dinheiro ou quantidade, informar o total e o valor conquistado, e ver quanto falta.
- Dividir objetivos em passos editáveis e marcar cada passo concluído.
- Filtrar registros, exportar um backup e restaurá-lo com confirmação.
- Usar o modo local ou conectar uma conta Supabase para sincronizar entre dispositivos.

Os registros iniciais são exemplos, identificados na tela. Use **Começar do zero** para apagá-los. Passos concluídos não alteram automaticamente o valor conquistado da meta; entradas financeiras também não são adicionadas automaticamente às metas.

## Desenvolvimento

Requer Node.js 24 e npm. O lockfile deve ser preservado.

```bash
cd /workspace/viachat
npm ci --cache /workspace/.npm-cache
npm run dev -- --port 4173 --strictPort
```

```bash
npm run build
npm test
```

Os testes usam Chromium em `/usr/bin/chromium` no ambiente de nuvem. Em outra máquina, instale Chromium e informe o caminho em `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. Os testes sobem seus próprios servidores nas portas 5173 e 5174; deixe essas portas livres. Os testes de nuvem usam respostas simuladas e **não** validam o projeto Supabase real nem suas políticas no servidor.

Sem configuração Supabase, os dados ficam apenas no armazenamento deste navegador. Limpar os dados do site, usar modo anônimo ou trocar de navegador/dispositivo não mantém esses dados. Exporte um backup regularmente. A aplicação não é um gerenciador financeiro conectado a bancos: os valores são informados por você.

## Publicar no GitHub Pages

O workflow `.github/workflows/pages.yml` gera o site e o publica em cada push para `main` ou execução manual.

1. Envie estes arquivos para a branch `main` do repositório `Ocriador-homemdevalor/viachat`.
2. No GitHub, abra **Settings → Pages → Build and deployment → Source** e selecione **GitHub Actions**. A disponibilidade de Pages depende da visibilidade do repositório e do plano da conta.
3. Abra **Actions → Publicar Viachat no GitHub Pages** e acompanhe a execução. Se necessário, execute **Run workflow** na branch `main`.
4. Use o endereço mostrado pelo deploy concluído. Não considere o site publicado antes de a execução passar.

O workflow usa `/viachat/` como base, derivado do nome do repositório. Para domínio próprio ou repositório `usuario.github.io`, ajuste `VITE_BASE_PATH` para `/`. Para testar a base de produção localmente:

```bash
VITE_BASE_PATH=/viachat/ npm run build
npm run preview -- --port 4175 --strictPort
```

GitHub Pages hospeda o aplicativo. **Ele não armazena os dados pessoais da conta nem sincroniza dispositivos.** Para isso, complete a seção abaixo.

## Ativar login e sincronização entre dispositivos

1. Crie um projeto Supabase em sua conta.
2. Execute o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) no SQL Editor do projeto. O script cria uma tabela por usuário, regras de acesso por conta (RLS) e controle de versão para evitar sobrescritas silenciosas entre dispositivos.
3. Em **Authentication**, habilite acesso por e-mail/senha. Configure a URL do site e os redirect URLs para o endereço publicado, incluindo o caminho `/viachat/`. Para desenvolvimento, permita também o endereço do servidor local usado por você.
4. No GitHub, abra **Settings → Secrets and variables → Actions → Variables** e crie:
   - `VITE_SUPABASE_URL`: URL pública do seu projeto.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: chave **publishable** (ou a chave legada **anon**).
5. Execute novamente o workflow de publicação. Essas configurações são incorporadas no build; alterá-las não modifica um site já publicado até gerar outro build.
6. Abra **Conta e configurações**, crie sua conta, confirme o e-mail se solicitado e entre. No primeiro acesso de uma conta nova, os dados locais são copiados para ela. Uma conta existente carrega seus próprios registros da nuvem.
7. Valide com uma conta real: crie uma atividade no primeiro dispositivo, espere **Salvo na nuvem**, entre no segundo dispositivo e confirme a atividade. Valide também que outra conta não consegue ler os dados da primeira. Se os dispositivos estiverem abertos ao mesmo tempo, use **Carregar dados da nuvem** no segundo para obter a versão atual.

Para desenvolvimento, copie `.env.example` para `.env.local` e preencha as duas configurações públicas, ou injete as variáveis no processo. Nunca use chaves **service_role**, chaves secretas ou senhas nas variáveis `VITE_*`: o conteúdo do frontend é público. Senhas de usuários são enviadas apenas ao serviço de autenticação; não são incluídas no backup.

Se a rede do ambiente estiver restrita, permita o domínio específico do projeto, por exemplo `seu-projeto.supabase.co`, além dos registros de pacotes já permitidos.

## Limites da sincronização

- As edições são salvas no navegador e enviadas após uma breve pausa, em sequência.
- Uma falha de rede conserva a cópia local e uma versão pendente por conta. Use **Tentar sincronizar** quando a conexão voltar. Após recarregar e recuperar a conexão, a versão pendente é reenviada se a nuvem não mudou; caso contrário, o app indica um conflito.
- Se outro dispositivo salvou uma versão mais recente, o app interrompe a edição para evitar sobrescritas. Exporte seu backup e use **Carregar versão atual**; depois, reaplique as alterações desejadas.
- A ação **Carregar dados da nuvem** descarta a versão pendente após confirmação. Exporte um backup antes se quiser guardá-la. A aplicação não possui mesclagem automática nem cache offline do site.

## Configuração do ambiente de nuvem

Cada tarefa já é isolada. Use este checkout e não crie um Git worktree sem solicitação explícita. O script de instalação deve executar `npm ci` e `npm run build`; os processos do servidor devem ser iniciados novamente em cada tarefa. Publicar o ambiente de desenvolvimento e publicar o site no GitHub Pages são operações distintas.
