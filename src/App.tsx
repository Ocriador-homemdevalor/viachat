import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Download,
  Home,
  Leaf,
  LoaderCircle,
  LogOut,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Upload,
  Wallet,
  X,
  Pencil,
  AlertCircle,
} from 'lucide-react'
import { cloud, cloudConfiguration } from './cloud'
import {
  emptyWorkspace,
  goalValue,
  id,
  isWorkspace,
  money,
  number,
  progress,
  remaining,
  today,
  totals,
  type Entry,
  type Goal,
  type Task,
  type Workspace,
} from './model'
import { useWorkspace } from './useWorkspace'

type Page = 'overview' | 'routine' | 'finances' | 'goals' | 'settings'
type Editor =
  | { kind: 'task'; item?: Task }
  | { kind: 'entry'; item?: Entry }
  | { kind: 'goal'; item?: Goal }
  | null
type Change = (fn: (data: Workspace) => Workspace) => boolean
const navigation = [
  { key: 'overview', label: 'Visão geral', icon: Home },
  { key: 'routine', label: 'Meu dia', icon: CalendarDays },
  { key: 'finances', label: 'Finanças', icon: Wallet },
  { key: 'goals', label: 'Metas e objetivos', icon: Target },
] as const
const monthLabel = (value: string) =>
  new Date(`${value}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

function Dialog({
  title,
  children,
  onClose,
  onSubmit,
  action = 'Salvar',
  busy = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void
  action?: string
  busy?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <form
        onSubmit={
          onSubmit ??
          ((e) => {
            e.preventDefault()
            onClose()
          })
        }
      >
        <div className="dialog-content">{children}</div>
        <div className="dialog-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" disabled={busy} type="submit">
            {busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
            {action}
          </button>
        </div>
      </form>
    </dialog>
  )
}

function Field({
  label,
  children,
  wide = false,
}: {
  label: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<Record<string, unknown>>, { 'aria-label': label })
        : children}
    </label>
  )
}

function Empty({
  icon,
  title,
  detail,
  onAdd,
  action,
}: {
  icon: ReactNode
  title: string
  detail: string
  onAdd?: () => void
  action?: string
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{detail}</p>
      {onAdd && (
        <button className="button primary" onClick={onAdd}>
          <Plus size={17} />
          {action ?? 'Adicionar'}
        </button>
      )}
    </div>
  )
}

function Stat({
  title,
  value,
  note,
  icon,
  color = 'green',
  trend,
}: {
  title: string
  value: string
  note: string
  icon: ReactNode
  color?: string
  trend?: string
}) {
  return (
    <article className="stat">
      <div className="stat-top">
        <span>{title}</span>
        <span className={`stat-icon ${color}`}>{icon}</span>
      </div>
      <strong>{value}</strong>
      <div className="stat-bottom">
        {trend && <span className={`stat-trend ${color}`}>{trend}</span>}
        <span>{note}</span>
      </div>
    </article>
  )
}

function GoalChart({ goal, small = false }: { goal: Goal; small?: boolean }) {
  const pct = progress(goal)
  return (
    <div
      className={`goal-chart ${small ? 'small' : ''}`}
      role="img"
      aria-label={`${goal.name}: ${number(pct)}% alcançado; faltam ${goalValue(remaining(goal), goal)}`}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="ring-track" cx="60" cy="60" r="49" />
        <circle
          className="ring-value"
          cx="60"
          cy="60"
          r="49"
          pathLength="100"
          strokeDasharray={`${pct} ${100 - pct}`}
        />
      </svg>
      <div className="ring-label">
        <strong>
          {Math.round(pct)}
          <span>%</span>
        </strong>
        {!small && <span>concluído</span>}
      </div>
    </div>
  )
}

function GoalSummary({ goal, onOpen }: { goal: Goal; onOpen: () => void }) {
  return (
    <button className="goal-summary" onClick={onOpen}>
      <GoalChart goal={goal} small />
      <div>
        <strong>{goal.name}</strong>
        <span>
          {goalValue(goal.current, goal)} de {goalValue(goal.target, goal)}
        </span>
        <small>
          {remaining(goal) > 0
            ? `Faltam ${goalValue(remaining(goal), goal)}`
            : 'Meta alcançada! 🎉'}
        </small>
      </div>
      <ChevronRight size={17} />
    </button>
  )
}

function Overview({
  data,
  update,
  onPage,
  onEdit,
}: {
  data: Workspace
  update: Change
  onPage: (page: Page) => void
  onEdit: (editor: Editor) => void
}) {
  const day = today()
  const daily = data.tasks
    .filter((t) => t.date === day)
    .sort((a, b) => a.time.localeCompare(b.time))
  const done = daily.filter((t) => t.status === 'Concluído').length
  const balance = totals(data.entries, day.slice(0, 7))
  const achieved = data.goals.filter((g) => remaining(g) === 0).length
  const nextSteps = data.goals
    .flatMap((g) =>
      g.steps
        .filter((s) => !s.done)
        .slice(0, 1)
        .map((s) => ({ goal: g, step: s })),
    )
    .slice(0, 3)
  return (
    <>
      <div className="welcome-banner">
        <div>
          <span className="eyebrow">
            <Sparkles size={14} /> UM PASSO DE CADA VEZ
          </span>
          <h2>
            Seu futuro começa
            <br />
            com o que você faz hoje.
          </h2>
          <p>Organize o presente. Construa o que vem depois.</p>
          <button onClick={() => onPage('goals')}>
            Ver minhas metas <ArrowRight size={17} />
          </button>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="art-chart">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="art-target">
            <Target size={44} strokeWidth={1.5} />
          </div>
          <span className="art-spark spark-one">✦</span>
          <span className="art-spark spark-two">✦</span>
        </div>
      </div>
      <div className="stats-grid">
        <Stat
          title="Saldo do mês"
          value={money(balance.balance)}
          note="entradas menos saídas"
          icon={<Wallet size={19} />}
        />
        <Stat
          title="Entradas do mês"
          value={money(balance.income)}
          note="recebidos neste mês"
          icon={<ArrowDownLeft size={19} />}
          color="blue"
        />
        <Stat
          title="Despesas do mês"
          value={money(balance.expenses)}
          note="registrados neste mês"
          icon={<ArrowUpRight size={19} />}
          color="orange"
        />
        <Stat
          title="Meu dia"
          value={`${done} / ${daily.length}`}
          note="atividades concluídas"
          icon={<CheckCircle2 size={19} />}
          color="purple"
          trend={daily.length ? `${Math.round((done / daily.length) * 100)}%` : undefined}
        />
      </div>
      <div className="overview-grid">
        <section className="panel routine-panel">
          <div className="panel-heading">
            <div>
              <h2>Seu dia, em ordem</h2>
              <p>Espaço para o que realmente importa.</p>
            </div>
            <button className="text-button" onClick={() => onPage('routine')}>
              Ver tudo <ArrowRight size={15} />
            </button>
          </div>
          {daily.length ? (
            <div className="agenda">
              {daily.slice(0, 5).map((t) => (
                <div
                  className={`agenda-row ${t.status === 'Concluído' ? 'completed' : ''}`}
                  key={t.id}
                >
                  <button
                    className={`check-button ${t.status === 'Concluído' ? 'checked' : ''}`}
                    aria-label={`${t.status === 'Concluído' ? 'Reabrir' : 'Concluir'} ${t.title}`}
                    onClick={() =>
                      update((d) => ({
                        ...d,
                        tasks: d.tasks.map((row) =>
                          row.id === t.id
                            ? {
                                ...row,
                                status: row.status === 'Concluído' ? 'A fazer' : 'Concluído',
                              }
                            : row,
                        ),
                      }))
                    }
                  >
                    {t.status === 'Concluído' && <Check size={13} />}
                  </button>
                  <span className="agenda-time">{t.time || '—'}</span>
                  <button
                    className="agenda-title"
                    onClick={() => onEdit({ kind: 'task', item: t })}
                  >
                    <strong>{t.title}</strong>
                    <small>{t.area || 'Sem categoria'}</small>
                  </button>
                  <span
                    className={`badge priority-${t.priority === 'Alta' ? 'high' : t.priority === 'Média' ? 'medium' : 'low'}`}
                  >
                    {t.priority}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon={<CalendarDays size={25} />}
              title="Seu dia está aberto"
              detail="Adicione uma atividade e dê o primeiro passo."
              onAdd={() => onEdit({ kind: 'task' })}
              action="Nova atividade"
            />
          )}
          {daily.length > 0 && (
            <div className="panel-footer">
              <div className="mini-progress">
                <span style={{ width: `${(done / daily.length) * 100}%` }} />
              </div>
              <span>
                {done === daily.length
                  ? 'Tudo feito. Aproveite sua conquista!'
                  : `${daily.length - done} ${daily.length - done === 1 ? 'atividade restante' : 'atividades restantes'}`}
              </span>
              <button
                className="icon-button"
                aria-label="Nova atividade"
                onClick={() => onEdit({ kind: 'task' })}
              >
                <Plus size={18} />
              </button>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Mais perto das suas metas</h2>
              <p>
                {achieved
                  ? `${achieved} ${achieved === 1 ? 'meta alcançada' : 'metas alcançadas'}. Continue assim!`
                  : 'Cada avanço conta.'}
              </p>
            </div>
            <button
              className="icon-button"
              aria-label="Nova meta"
              onClick={() => onEdit({ kind: 'goal' })}
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="goal-summaries">
            {data.goals.slice(0, 3).map((g) => (
              <GoalSummary key={g.id} goal={g} onOpen={() => onPage('goals')} />
            ))}
            {!data.goals.length && (
              <Empty
                icon={<Target size={25} />}
                title="O que você quer conquistar?"
                detail="Dê um nome ao seu próximo objetivo."
                onAdd={() => onEdit({ kind: 'goal' })}
                action="Criar meta"
              />
            )}
          </div>
        </section>
      </div>
      <section className="panel next-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow muted">DO PLANO À AÇÃO</span>
            <h2>Seu próximo passo</h2>
          </div>
          <Leaf size={23} className="leaf-icon" />
        </div>
        {nextSteps.length ? (
          <div className="next-grid">
            {nextSteps.map(({ goal, step }, index) => (
              <button className="next-step" key={step.id} onClick={() => onPage('goals')}>
                <span className="step-number">0{index + 1}</span>
                <div>
                  <small>{goal.name}</small>
                  <strong>{step.title}</strong>
                </div>
                <ArrowRight size={18} />
              </button>
            ))}
          </div>
        ) : (
          <p className="next-empty">
            Divida suas metas em pequenos passos. Eles aparecerão aqui para ajudar você a começar.
          </p>
        )}
      </section>
    </>
  )
}

function NumericCell({
  value,
  label,
  onChange,
}: {
  value: number
  label: string
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const commit = () => {
    const next = Number(draft.replace(',', '.'))
    if (draft.trim() && Number.isFinite(next) && next >= 0 && next <= 1e12) {
      onChange(next)
      setDraft(String(next))
    } else setDraft(String(value))
  }
  return (
    <input
      className="cell-input numeric"
      aria-label={label}
      type="number"
      min="0"
      max="1000000000000"
      step="0.01"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
    />
  )
}

function Routine({
  data,
  update,
  onEdit,
  onDelete,
}: {
  data: Workspace
  update: Change
  onEdit: (editor: Editor) => void
  onDelete: (item: Task) => void
}) {
  const [day, setDay] = useState(today())
  const [query, setQuery] = useState('')
  const [all, setAll] = useState(false)
  const [filter, setFilter] = useState('Todas')
  const rows = data.tasks
    .filter(
      (t) =>
        (all || t.date === day) &&
        (filter === 'Todas' || t.status === filter) &&
        `${t.title} ${t.area}`
          .toLocaleLowerCase('pt-BR')
          .includes(query.toLocaleLowerCase('pt-BR')),
    )
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
  const edit = <K extends keyof Task>(task: Task, key: K, value: Task[K]) =>
    update((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, [key]: value } : t)),
    }))
  return (
    <section className="panel table-panel">
      <div className="table-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Buscar atividades"
            placeholder="Buscar atividade…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="toolbar-controls">
          <input
            aria-label="Dia das atividades"
            type="date"
            value={day}
            disabled={all}
            onChange={(e) => setDay(e.target.value)}
          />
          <label className="toggle-label">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
            Todos os dias
          </label>
          <select
            aria-label="Filtrar status"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {['Todas', 'A fazer', 'Em andamento', 'Concluído'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="table-hint">
        <Pencil size={13} /> Clique nos campos da tabela para editar.
      </div>
      {rows.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="check-col">
                  <Check size={15} />
                </th>
                <th>Atividade</th>
                <th>Data</th>
                <th>Horário</th>
                <th>Área da vida</th>
                <th>Prioridade</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t, index) => (
                <tr key={t.id} className={t.status === 'Concluído' ? 'done-row' : ''}>
                  <td>
                    <button
                      className={`check-button ${t.status === 'Concluído' ? 'checked' : ''}`}
                      aria-label={`Concluir atividade ${index + 1}`}
                      onClick={() =>
                        edit(t, 'status', t.status === 'Concluído' ? 'A fazer' : 'Concluído')
                      }
                    >
                      {t.status === 'Concluído' && <Check size={13} />}
                    </button>
                  </td>
                  <td className="title-cell">
                    <input
                      className="cell-input title-input"
                      aria-label={`Atividade ${index + 1}`}
                      maxLength={5000}
                      value={t.title}
                      onChange={(e) => edit(t, 'title', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input"
                      aria-label={`Data da atividade ${index + 1}`}
                      type="date"
                      value={t.date}
                      onChange={(e) => edit(t, 'date', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input"
                      aria-label={`Horário da atividade ${index + 1}`}
                      type="time"
                      value={t.time}
                      onChange={(e) => edit(t, 'time', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="cell-input"
                      aria-label={`Área da atividade ${index + 1}`}
                      value={t.area}
                      maxLength={5000}
                      onChange={(e) => edit(t, 'area', e.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      className={`cell-input priority-select priority-${t.priority === 'Alta' ? 'high' : t.priority === 'Média' ? 'medium' : 'low'}`}
                      aria-label={`Prioridade da atividade ${index + 1}`}
                      value={t.priority}
                      onChange={(e) => edit(t, 'priority', e.target.value as Task['priority'])}
                    >
                      {['Baixa', 'Média', 'Alta'].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="cell-input"
                      aria-label={`Status da atividade ${index + 1}`}
                      value={t.status}
                      onChange={(e) => edit(t, 'status', e.target.value as Task['status'])}
                    >
                      {['A fazer', 'Em andamento', 'Concluído'].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        aria-label={`Editar ${t.title}`}
                        onClick={() => onEdit({ kind: 'task', item: t })}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-button danger"
                        aria-label={`Excluir ${t.title}`}
                        onClick={() => onDelete(t)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          icon={<CalendarDays size={27} />}
          title={
            data.tasks.length
              ? 'Nenhuma atividade neste filtro'
              : 'Faça espaço para suas prioridades'
          }
          detail={
            data.tasks.length
              ? 'Escolha outro dia ou ajuste a busca.'
              : 'Planeje o dia com atividades, horários e prioridades.'
          }
          onAdd={() => onEdit({ kind: 'task' })}
          action="Nova atividade"
        />
      )}
      <div className="table-bottom">
        <span>
          {rows.length} {rows.length === 1 ? 'atividade' : 'atividades'}
        </span>
        <button className="text-button" onClick={() => onEdit({ kind: 'task' })}>
          <Plus size={15} />
          Adicionar linha
        </button>
      </div>
    </section>
  )
}

function Finances({
  data,
  update,
  onEdit,
  onDelete,
}: {
  data: Workspace
  update: Change
  onEdit: (editor: Editor) => void
  onDelete: (item: Entry) => void
}) {
  const [month, setMonth] = useState(today().slice(0, 7))
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('Todos')
  const [all, setAll] = useState(false)
  const rows = data.entries
    .filter(
      (e) =>
        (all || e.date.startsWith(month)) &&
        (kind === 'Todos' || e.kind === kind) &&
        `${e.description} ${e.category}`
          .toLocaleLowerCase('pt-BR')
          .includes(query.toLocaleLowerCase('pt-BR')),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
  const total = all
    ? {
        income: data.entries.filter((e) => e.kind === 'Entrada').reduce((s, e) => s + e.amount, 0),
        expenses: data.entries.filter((e) => e.kind === 'Saída').reduce((s, e) => s + e.amount, 0),
        balance: 0,
      }
    : totals(data.entries, month)
  total.balance = total.income - total.expenses
  const categories = Object.entries(
    data.entries
      .filter((e) => e.kind === 'Saída' && (all || e.date.startsWith(month)))
      .reduce<Record<string, number>>(
        (s, e) => ({
          ...s,
          [e.category || 'Sem categoria']: (s[e.category || 'Sem categoria'] ?? 0) + e.amount,
        }),
        {},
      ),
  ).sort((a, b) => b[1] - a[1])
  const edit = <K extends keyof Entry>(entry: Entry, key: K, value: Entry[K]) =>
    update((d) => ({
      ...d,
      entries: d.entries.map((e) => (e.id === entry.id ? { ...e, [key]: value } : e)),
    }))
  return (
    <>
      <div className="finance-period">
        <span>{all ? 'Todo o período' : monthLabel(month)}</span>
        <div className="toolbar-controls">
          <input
            aria-label="Mês das finanças"
            type="month"
            value={month}
            disabled={all}
            onChange={(e) => {
              if (e.target.value) setMonth(e.target.value)
            }}
          />
          <label className="toggle-label">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
            Todos os meses
          </label>
        </div>
      </div>
      <div className="stats-grid three">
        <Stat
          title="Entradas"
          value={money(total.income)}
          note="salário, ganhos e outras receitas"
          icon={<ArrowDownLeft size={19} />}
          color="green"
        />
        <Stat
          title="Saídas"
          value={money(total.expenses)}
          note="despesas registradas"
          icon={<ArrowUpRight size={19} />}
          color="orange"
        />
        <Stat
          title="Saldo"
          value={money(total.balance)}
          note="entradas menos saídas"
          icon={<Wallet size={19} />}
          color="blue"
        />
      </div>
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Buscar lançamentos"
              placeholder="Buscar lançamento…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Filtrar lançamentos"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {['Todos', 'Entrada', 'Saída'].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </div>
        <div className="table-hint">
          <Pencil size={13} /> Seus valores e categorias são totalmente editáveis.
        </div>
        {rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Data</th>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th className="align-right">Valor (R$)</th>
                  <th>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e, index) => (
                  <tr key={e.id}>
                    <td className="title-cell">
                      <input
                        className="cell-input title-input"
                        aria-label={`Descrição do lançamento ${index + 1}`}
                        maxLength={5000}
                        value={e.description}
                        onChange={(event) => edit(e, 'description', event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="cell-input"
                        aria-label={`Data do lançamento ${index + 1}`}
                        type="date"
                        value={e.date}
                        onChange={(event) => edit(e, 'date', event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="cell-input"
                        aria-label={`Categoria do lançamento ${index + 1}`}
                        maxLength={5000}
                        value={e.category}
                        onChange={(event) => edit(e, 'category', event.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        className={`cell-input ${e.kind === 'Entrada' ? 'income-text' : 'expense-text'}`}
                        aria-label={`Tipo do lançamento ${index + 1}`}
                        value={e.kind}
                        onChange={(event) => edit(e, 'kind', event.target.value as Entry['kind'])}
                      >
                        <option>Entrada</option>
                        <option>Saída</option>
                      </select>
                    </td>
                    <td>
                      <NumericCell
                        label={`Valor do lançamento ${index + 1}`}
                        value={e.amount}
                        onChange={(value) => edit(e, 'amount', value)}
                      />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          aria-label={`Editar ${e.description}`}
                          onClick={() => onEdit({ kind: 'entry', item: e })}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="icon-button danger"
                          aria-label={`Excluir ${e.description}`}
                          onClick={() => onDelete(e)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<Wallet size={27} />}
            title="Nenhum lançamento por aqui"
            detail="Registre o que entra e o que sai para acompanhar seu dinheiro."
            onAdd={() => onEdit({ kind: 'entry' })}
            action="Novo lançamento"
          />
        )}
        <div className="table-bottom">
          <span>
            {rows.length} {rows.length === 1 ? 'lançamento' : 'lançamentos'}
          </span>
          <button className="text-button" onClick={() => onEdit({ kind: 'entry' })}>
            <Plus size={15} />
            Adicionar linha
          </button>
        </div>
      </section>
      <section className="panel spending-panel">
        <div className="panel-heading">
          <div>
            <h2>Para onde vai seu dinheiro</h2>
            <p>Despesas por categoria · {all ? 'todo o período' : monthLabel(month)}</p>
          </div>
          <Wallet size={21} className="muted" />
        </div>
        {categories.length ? (
          <div className="category-chart">
            {categories.map(([category, amount], index) => (
              <div className="category-row" key={category}>
                <span>{category}</span>
                <div className="category-track">
                  <span
                    style={{
                      width: `${total.expenses ? (amount / total.expenses) * 100 : 0}%`,
                      background: ['#176b53', '#5b9382', '#85b3a5', '#adcdbf'][index % 4],
                    }}
                  />
                </div>
                <strong>{money(amount)}</strong>
                <small>{total.expenses ? Math.round((amount / total.expenses) * 100) : 0}%</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="next-empty">O gráfico aparece quando você registra sua primeira despesa.</p>
        )}
      </section>
    </>
  )
}

function GoalCard({
  goal,
  update,
  onEdit,
  onDelete,
}: {
  goal: Goal
  update: Change
  onEdit: () => void
  onDelete: () => void
}) {
  const [step, setStep] = useState('')
  const change = (fn: (goal: Goal) => Goal) =>
    update((d) => ({ ...d, goals: d.goals.map((g) => (g.id === goal.id ? fn(g) : g)) }))
  const deadline = goal.deadline
    ? new Date(`${goal.deadline}T12:00:00`).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'Sem prazo definido'
  const achieved = remaining(goal) === 0
  const overdue = !achieved && goal.deadline && goal.deadline < today()
  return (
    <article className={`panel goal-card ${achieved ? 'achieved' : ''}`}>
      <div className="goal-card-heading">
        <span className={`badge ${achieved ? 'success' : overdue ? 'priority-high' : 'neutral'}`}>
          {achieved ? 'Meta alcançada' : overdue ? 'Prazo passou' : 'Em construção'}
        </span>
        <div className="row-actions">
          <button className="icon-button" aria-label={`Editar ${goal.name}`} onClick={onEdit}>
            <Pencil size={16} />
          </button>
          <button
            className="icon-button danger"
            aria-label={`Excluir ${goal.name}`}
            onClick={onDelete}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <h2>{goal.name}</h2>
      <p className="goal-reason">
        {goal.reason || 'Edite sua meta para registrar por que ela importa.'}
      </p>
      <div className="goal-visual">
        <GoalChart goal={goal} />
        <div>
          <span>Você já conquistou</span>
          <strong>{goalValue(goal.current, goal)}</strong>
          <small>de {goalValue(goal.target, goal)}</small>
          <div className="remaining">
            <span>{achieved ? 'Você chegou lá!' : 'Ainda faltam'}</span>
            <strong>{achieved ? 'Parabéns! 🎉' : goalValue(remaining(goal), goal)}</strong>
          </div>
        </div>
      </div>
      <div className="goal-deadline">
        <CalendarDays size={14} />
        {deadline}
        <button className="text-button" onClick={onEdit}>
          Atualizar progresso <ArrowUpRight size={14} />
        </button>
      </div>
      <div className="steps-heading">
        <h3>O que preciso fazer</h3>
        <span>
          {goal.steps.filter((s) => s.done).length}/{goal.steps.length}
        </span>
      </div>
      <div className="goal-steps">
        {goal.steps.map((s, index) => (
          <div className="goal-step" key={s.id}>
            <input
              type="checkbox"
              checked={s.done}
              aria-label={`Concluir passo ${index + 1} de ${goal.name}`}
              onChange={(e) =>
                change((g) => ({
                  ...g,
                  steps: g.steps.map((row) =>
                    row.id === s.id ? { ...row, done: e.target.checked } : row,
                  ),
                }))
              }
            />
            <input
              className={`step-input ${s.done ? 'completed' : ''}`}
              aria-label={`Passo ${index + 1} de ${goal.name}`}
              maxLength={5000}
              value={s.title}
              onChange={(e) =>
                change((g) => ({
                  ...g,
                  steps: g.steps.map((row) =>
                    row.id === s.id ? { ...row, title: e.target.value } : row,
                  ),
                }))
              }
            />
            <button
              className="icon-button danger"
              aria-label={`Excluir passo ${s.title}`}
              onClick={() =>
                change((g) => ({ ...g, steps: g.steps.filter((row) => row.id !== s.id) }))
              }
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <form
        className="add-step"
        onSubmit={(e) => {
          e.preventDefault()
          if (step.trim()) {
            change((g) => ({
              ...g,
              steps: [...g.steps, { id: id(), title: step.trim(), done: false }],
            }))
            setStep('')
          }
        }}
      >
        <Plus size={16} />
        <input
          aria-label={`Novo passo de ${goal.name}`}
          placeholder="Adicionar um pequeno passo…"
          maxLength={5000}
          value={step}
          onChange={(e) => setStep(e.target.value)}
        />
        <button
          className="icon-button"
          type="submit"
          aria-label={`Adicionar passo em ${goal.name}`}
          disabled={!step.trim()}
        >
          <ArrowRight size={16} />
        </button>
      </form>
      <p className="goal-note">
        Os passos organizam o plano. Atualize o valor conquistado para avançar no gráfico.
      </p>
    </article>
  )
}

function Goals({
  data,
  update,
  onEdit,
  onDelete,
}: {
  data: Workspace
  update: Change
  onEdit: (editor: Editor) => void
  onDelete: (item: Goal) => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('Todas')
  const rows = data.goals.filter(
    (g) =>
      `${g.name} ${g.reason}`
        .toLocaleLowerCase('pt-BR')
        .includes(query.toLocaleLowerCase('pt-BR')) &&
      (filter === 'Todas' || (filter === 'Alcançadas' ? remaining(g) === 0 : remaining(g) > 0)),
  )
  return (
    <>
      <div className="goals-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Buscar metas"
            placeholder="Buscar uma meta…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="segmented" aria-label="Filtrar metas">
          {['Todas', 'Em andamento', 'Alcançadas'].map((s) => (
            <button className={s === filter ? 'selected' : ''} key={s} onClick={() => setFilter(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>
      {rows.length ? (
        <>
          <div className="goals-grid">
            {rows.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                update={update}
                onEdit={() => onEdit({ kind: 'goal', item: goal })}
                onDelete={() => onDelete(goal)}
              />
            ))}
          </div>
          <section className="panel comparison-panel">
            <div className="panel-heading">
              <div>
                <h2>Quanto falta para chegar lá</h2>
                <p>Progresso de cada meta em relação ao total planejado.</p>
              </div>
              <Target size={22} className="muted" />
            </div>
            <div className="comparison-legend">
              <span>
                <i />
                Conquistado
              </span>
              <span>
                <i />
                Falta conquistar
              </span>
            </div>
            <div className="comparison-chart">
              {rows.map((g) => (
                <div className="comparison-row" key={g.id}>
                  <div>
                    <strong>{g.name}</strong>
                    <span>{Math.round(progress(g))}%</span>
                  </div>
                  <div
                    className="comparison-track"
                    role="img"
                    aria-label={`${g.name}: faltam ${goalValue(remaining(g), g)}`}
                  >
                    <span style={{ width: `${progress(g)}%` }} />
                  </div>
                  <small>Faltam {goalValue(remaining(g), g)}</small>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="panel">
          <Empty
            icon={<Target size={30} />}
            title={
              data.goals.length ? 'Nenhuma meta neste filtro' : 'Toda conquista começa com uma meta'
            }
            detail={
              data.goals.length
                ? 'Ajuste sua busca para encontrar outros objetivos.'
                : 'Escolha um objetivo, defina o total e planeje os passos.'
            }
            onAdd={() => onEdit({ kind: 'goal' })}
            action="Criar minha primeira meta"
          />
        </section>
      )}
    </>
  )
}

function EditorDialog({
  editor,
  onClose,
  update,
}: {
  editor: NonNullable<Editor>
  onClose: () => void
  update: Change
}) {
  const existing = editor.item
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const get = (key: string) => String(form.get(key) ?? '').trim()
    let saved = false
    if (editor.kind === 'task') {
      const row: Task = {
        id: existing?.id ?? id(),
        title: get('title'),
        date: get('date'),
        time: get('time'),
        area: get('area'),
        priority: get('priority') as Task['priority'],
        status: get('status') as Task['status'],
      }
      saved = update((d) => ({
        ...d,
        tasks: existing ? d.tasks.map((t) => (t.id === row.id ? row : t)) : [...d.tasks, row],
      }))
    } else if (editor.kind === 'entry') {
      const row: Entry = {
        id: existing?.id ?? id(),
        description: get('description'),
        date: get('date'),
        amount: Number(get('amount')),
        category: get('category'),
        kind: get('kind') as Entry['kind'],
      }
      saved = update((d) => ({
        ...d,
        entries: existing ? d.entries.map((e) => (e.id === row.id ? row : e)) : [...d.entries, row],
      }))
    } else {
      const row: Goal = {
        id: existing?.id ?? id(),
        name: get('name'),
        target: Number(get('target')),
        current: Number(get('current')),
        unit: get('unit') as Goal['unit'],
        deadline: get('deadline'),
        reason: get('reason'),
        steps: editor.item?.steps ?? [],
      }
      saved = update((d) => ({
        ...d,
        goals: existing ? d.goals.map((g) => (g.id === row.id ? row : g)) : [...d.goals, row],
      }))
    }
    if (saved) onClose()
  }
  return (
    <Dialog
      title={`${existing ? 'Editar' : editor.kind === 'task' ? 'Nova' : editor.kind === 'entry' ? 'Novo' : 'Nova'} ${editor.kind === 'task' ? 'atividade' : editor.kind === 'entry' ? 'lançamento' : 'meta'}`}
      onClose={onClose}
      onSubmit={save}
    >
      <div className="form-grid">
        {editor.kind === 'task' ? (
          <>
            <Field label="O que você vai fazer?" wide>
              <input
                autoFocus
                name="title"
                placeholder="Ex.: estudar por 30 minutos"
                required
                maxLength={5000}
                defaultValue={editor.item?.title}
              />
            </Field>
            <Field label="Data">
              <input name="date" type="date" required defaultValue={editor.item?.date ?? today()} />
            </Field>
            <Field label="Horário">
              <input name="time" type="time" defaultValue={editor.item?.time ?? ''} />
            </Field>
            <Field label="Área da vida" wide>
              <input
                name="area"
                placeholder="Ex.: trabalho, saúde, estudos"
                maxLength={5000}
                defaultValue={editor.item?.area ?? 'Pessoal'}
              />
            </Field>
            <Field label="Prioridade">
              <select name="priority" defaultValue={editor.item?.priority ?? 'Média'}>
                <option>Baixa</option>
                <option>Média</option>
                <option>Alta</option>
              </select>
            </Field>
            <Field label="Status">
              <select name="status" defaultValue={editor.item?.status ?? 'A fazer'}>
                <option>A fazer</option>
                <option>Em andamento</option>
                <option>Concluído</option>
              </select>
            </Field>
          </>
        ) : editor.kind === 'entry' ? (
          <>
            <Field label="Descrição" wide>
              <input
                autoFocus
                name="description"
                required
                placeholder="Ex.: salário, supermercado"
                maxLength={5000}
                defaultValue={editor.item?.description}
              />
            </Field>
            <Field label="Tipo">
              <select name="kind" defaultValue={editor.item?.kind ?? 'Entrada'}>
                <option>Entrada</option>
                <option>Saída</option>
              </select>
            </Field>
            <Field label="Valor (R$)">
              <input
                name="amount"
                type="number"
                min="0.01"
                max="1000000000000"
                step="0.01"
                required
                defaultValue={editor.item?.amount}
                placeholder="0,00"
              />
            </Field>
            <Field label="Data">
              <input name="date" type="date" required defaultValue={editor.item?.date ?? today()} />
            </Field>
            <Field label="Categoria">
              <input
                name="category"
                required
                maxLength={5000}
                defaultValue={editor.item?.category}
                placeholder="Ex.: alimentação"
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Qual é o seu objetivo?" wide>
              <input
                autoFocus
                name="name"
                required
                maxLength={5000}
                placeholder="Ex.: minha reserva de emergência"
                defaultValue={editor.item?.name}
              />
            </Field>
            <Field label="Como você vai medir?">
              <select name="unit" defaultValue={editor.item?.unit ?? 'R$'}>
                <option value="R$">Dinheiro (R$)</option>
                <option value="unidades">Quantidade / unidades</option>
              </select>
            </Field>
            <Field label="Até quando?">
              <input name="deadline" type="date" defaultValue={editor.item?.deadline} />
            </Field>
            <Field label="Total da meta">
              <input
                name="target"
                type="number"
                min="0.01"
                max="1000000000000"
                step="0.01"
                required
                placeholder="Ex.: 10000"
                defaultValue={editor.item?.target}
              />
            </Field>
            <Field label="Já conquistado">
              <input
                name="current"
                type="number"
                min="0"
                max="1000000000000"
                step="0.01"
                required
                defaultValue={editor.item?.current ?? 0}
              />
            </Field>
            <Field label="Por que isso importa para você?" wide>
              <textarea
                name="reason"
                rows={3}
                maxLength={5000}
                placeholder="Escreva o motivo que vai te ajudar a continuar."
                defaultValue={editor.item?.reason}
              />
            </Field>
            <p className="form-note wide">
              Depois de salvar, adicione os passos necessários no cartão da meta. Valores
              conquistados são informados por você; o saldo financeiro não é somado automaticamente.
            </p>
          </>
        )}
      </div>
    </Dialog>
  )
}

function Account({ email, onReload }: { email?: string; onReload: () => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const authenticate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!cloud) return
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setMessage('')
    try {
      const credentials = {
        email: String(form.get('email')).trim(),
        password: String(form.get('password')),
      }
      const { data, error } =
        mode === 'login'
          ? await cloud.auth.signInWithPassword(credentials)
          : await cloud.auth.signUp({
              ...credentials,
              options: {
                emailRedirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).href,
              },
            })
      if (error) {
        setFailed(true)
        setMessage(
          mode === 'login'
            ? 'Não foi possível entrar. Confira e-mail, senha e a confirmação do cadastro.'
            : 'Não foi possível criar a conta. Confira os dados e tente novamente.',
        )
      } else {
        setFailed(false)
        setMessage(
          mode === 'signup' && !data.session
            ? 'Confira seu e-mail para confirmar o cadastro. Depois, entre aqui.'
            : 'Conectado. Seus dados serão carregados.',
        )
      }
    } catch {
      setFailed(true)
      setMessage('Não foi possível conectar. Confira sua conexão e tente novamente.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="panel settings-panel">
      <div className="panel-heading">
        <div>
          <h2>
            <Cloud size={20} /> Acesso em qualquer lugar
          </h2>
          <p>Use sua conta para acessar os mesmos dados no celular e no computador.</p>
        </div>
      </div>
      {!cloud ? (
        <div
          className={`cloud-pending ${cloudConfiguration.status === 'invalid' ? 'configuration-error' : ''}`}
          role={cloudConfiguration.status === 'invalid' ? 'alert' : 'status'}
        >
          <span className="setup-icon">
            <Cloud size={29} />
          </span>
          <div>
            <h3>
              {cloudConfiguration.status === 'invalid'
                ? 'A conexão com a nuvem precisa de correção'
                : 'A nuvem ainda precisa ser conectada'}
            </h3>
            {cloudConfiguration.status === 'invalid' && <p>{cloudConfiguration.message}</p>}
            <p>
              Seus dados estão salvos somente neste navegador. Eles ainda não aparecem em outro
              celular ou computador. Exporte um backup para guardar uma cópia.
            </p>
            <span className="badge neutral">
              {cloudConfiguration.status === 'invalid'
                ? 'Sincronização indisponível'
                : 'Modo local'}
            </span>
          </div>
        </div>
      ) : email ? (
        <div className="account-connected">
          <span className="setup-icon">
            <ShieldCheck size={27} />
          </span>
          <div>
            <h3>Você está conectado</h3>
            <p>{email}</p>
            <p>
              As alterações são enviadas para sua conta. Confira “Salvo na nuvem” antes de trocar de
              dispositivo.
            </p>
          </div>
          <button
            className="button secondary"
            onClick={async () => {
              setBusy(true)
              try {
                const { error } = await cloud!.auth.signOut()
                if (error) {
                  setFailed(true)
                  setMessage('Não foi possível sair. Tente novamente.')
                }
              } catch {
                setFailed(true)
                setMessage('Não foi possível sair. Tente novamente.')
              } finally {
                setBusy(false)
              }
            }}
            disabled={busy}
          >
            <LogOut size={15} />
            Sair
          </button>
          <button className="text-button" onClick={onReload}>
            Carregar dados da nuvem
          </button>
        </div>
      ) : (
        <>
          <p className="form-note">
            Entre ou crie uma conta para ativar a sincronização. Até entrar, os dados permanecem
            neste navegador.
          </p>
          <div className="segmented account-tabs">
            <button
              className={mode === 'login' ? 'selected' : ''}
              aria-pressed={mode === 'login'}
              onClick={() => {
                setMode('login')
                setMessage('')
              }}
            >
              Entrar
            </button>
            <button
              className={mode === 'signup' ? 'selected' : ''}
              aria-pressed={mode === 'signup'}
              onClick={() => {
                setMode('signup')
                setMessage('')
              }}
            >
              Criar conta
            </button>
          </div>
          <form className="account-form" onSubmit={authenticate}>
            <Field label="E-mail">
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="voce@exemplo.com"
              />
            </Field>
            <Field label="Senha">
              <input
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="Pelo menos 8 caracteres"
              />
            </Field>
            <button className="button primary" disabled={busy}>
              {busy && <LoaderCircle className="spin" size={17} />}
              {mode === 'login' ? 'Entrar na minha conta' : 'Criar minha conta'}
            </button>
          </form>
          <p className="form-note">
            Na primeira conexão de uma conta nova, os dados deste navegador serão copiados para ela.
            Uma conta existente carrega seus dados da nuvem.
          </p>
        </>
      )}
      {message && (
        <p className={`auth-message ${failed ? 'error' : ''}`} role="status">
          {message}
        </p>
      )}
    </section>
  )
}

function SettingsPage({
  data,
  sessionEmail,
  onImport,
  onReset,
  onReload,
}: {
  data: Workspace
  sessionEmail?: string
  onImport: (data: Workspace) => void
  onReset: () => void
  onReload: () => void
}) {
  const file = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  function exportBackup() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `viachat-backup-${today()}.json`
    link.click()
    URL.revokeObjectURL(url)
    setMessage('Backup exportado. Guarde o arquivo em um lugar seguro.')
  }
  return (
    <>
      <Account email={sessionEmail} onReload={onReload} />
      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>
              <ShieldCheck size={20} /> Seus dados, com você
            </h2>
            <p>Exporte uma cópia ou restaure um backup do Viachat.</p>
          </div>
        </div>
        <div className="backup-actions">
          <button className="button secondary" onClick={exportBackup}>
            <Download size={17} />
            Exportar backup
          </button>
          <button className="button secondary" onClick={() => file.current?.click()}>
            <Upload size={17} />
            Importar backup
          </button>
          <input
            className="sr-only"
            ref={file}
            type="file"
            accept=".json,application/json"
            aria-label="Arquivo de backup"
            onChange={async (e) => {
              const selected = e.target.files?.[0]
              e.target.value = ''
              if (!selected) return
              if (selected.size > 5 * 1024 * 1024) {
                setMessage('O backup deve ter no máximo 5 MB.')
                return
              }
              try {
                const imported: unknown = JSON.parse(await selected.text())
                if (!isWorkspace(imported)) throw new Error('Invalid backup')
                onImport(imported)
                setMessage('Confira o backup na confirmação antes de substituir os dados.')
              } catch {
                setMessage('Arquivo inválido. Escolha um backup JSON exportado pelo Viachat.')
              }
            }}
          />
        </div>
        {message && (
          <p role="status" className="form-note">
            {message}
          </p>
        )}
        <div className="privacy-note">
          <ShieldCheck size={17} />
          <p>
            O backup contém suas informações pessoais. No modo local, limpar os dados do navegador
            pode apagar seus registros. Exporte uma cópia regularmente.
          </p>
        </div>
      </section>
      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>Um novo começo</h2>
            <p>Apague os registros e comece com um painel vazio.</p>
          </div>
        </div>
        <button className="button danger-button" onClick={onReset}>
          <Trash2 size={17} />
          Apagar todos os registros
        </button>
      </section>
    </>
  )
}

export default function App() {
  const store = useWorkspace()
  const [page, setPage] = useState<Page>('overview')
  const [editor, setEditor] = useState<Editor>(null)
  const [confirmation, setConfirmation] = useState<{
    title: string
    detail: string
    action: string
    run: () => void
  } | null>(null)
  const [toast, setToast] = useState('')
  const currentDate = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const titles = {
    overview: [
      'Tudo começa com um bom plano.',
      'Seu dia, seu dinheiro e seus sonhos. Em um só lugar.',
    ],
    routine: ['Meu dia', 'Organize sua rotina e faça cada hora valer a pena.'],
    finances: ['Minhas finanças', 'Entenda seu dinheiro e faça escolhas com mais clareza.'],
    goals: ['Metas e objetivos', 'Transforme o que você quer em um plano para chegar lá.'],
    settings: [
      'Minha conta e meus dados',
      'Cuide dos seus registros e conecte seu próximo dispositivo.',
    ],
  }
  const navigate = (next: Page) => {
    setPage(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const notify = (message: string) => setToast(message)
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(timer)
  }, [toast])
  const reset = () =>
    setConfirmation({
      title: 'Começar do zero?',
      detail:
        'Todas as atividades, finanças e metas serão apagadas. Exporte um backup antes se quiser guardá-las.',
      action: 'Apagar e começar',
      run: () => {
        store.update(() => emptyWorkspace())
        notify('Seu painel está pronto para um novo começo.')
      },
    })
  const deleteTask = (task: Task) =>
    setConfirmation({
      title: 'Excluir atividade?',
      detail: `“${task.title}” será removida da sua rotina.`,
      action: 'Excluir atividade',
      run: () => {
        store.update((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== task.id) }))
        notify('Atividade excluída.')
      },
    })
  const deleteEntry = (entry: Entry) =>
    setConfirmation({
      title: 'Excluir lançamento?',
      detail: `“${entry.description}” será removido. Os totais serão recalculados.`,
      action: 'Excluir lançamento',
      run: () => {
        store.update((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== entry.id) }))
        notify('Lançamento excluído.')
      },
    })
  const deleteGoal = (goal: Goal) =>
    setConfirmation({
      title: 'Excluir meta?',
      detail: `“${goal.name}” e seus passos serão removidos.`,
      action: 'Excluir meta',
      run: () => {
        store.update((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== goal.id) }))
        notify('Meta excluída.')
      },
    })
  const reloadCloud = () =>
    setConfirmation({
      title: 'Carregar a versão da nuvem?',
      detail:
        'Os dados na tela serão substituídos pela versão salva na nuvem. Exporte um backup se houver alterações pendentes.',
      action: 'Carregar da nuvem',
      run: store.discardAndReload,
    })
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault()
            navigate('overview')
          }}
          aria-label="Viachat início"
        >
          <span className="brand-mark">
            <Check size={24} strokeWidth={3} />
          </span>
          <span>
            viachat<span className="brand-dot">.</span>
          </span>
        </a>
        <p className="sidebar-caption">SUA VIDA EM MOVIMENTO</p>
        <nav aria-label="Navegação principal">
          {navigation.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              aria-label={label}
              className={`nav-item ${page === key ? 'active' : ''}`}
              aria-current={page === key ? 'page' : undefined}
              onClick={() => navigate(key)}
            >
              <Icon size={20} strokeWidth={1.7} />
              <span>{label}</span>
              {key === 'goals' && store.data.goals.length > 0 && (
                <small>{store.data.goals.length}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-spark">✦</span>
            <h3>
              Seu ritmo.
              <br />
              Seu caminho.
            </h3>
            <p>
              Um pouco de organização,
              <br />
              um mundo de possibilidades.
            </p>
          </div>
          <button
            aria-label="Conta e configurações"
            className={`nav-item ${page === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('settings')}
          >
            <Settings size={19} strokeWidth={1.7} />
            <span>Conta e configurações</span>
          </button>
          <div className="sidebar-status">
            <span className={`status-dot ${store.session ? 'connected' : ''}`} />
            {store.session ? 'Conta conectada' : 'Seus dados neste navegador'}
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Meu espaço</span>
            <ChevronRight size={14} />
            <strong>
              {page === 'settings'
                ? 'Configurações'
                : navigation.find((n) => n.key === page)?.label}
            </strong>
          </div>
          <div className="topbar-right">
            <button className="save-status" onClick={() => navigate('settings')}>
              <Cloud size={16} />
              <span>{store.status}</span>
            </button>
            <span className="topbar-divider" />
            <button
              className="avatar"
              onClick={() => navigate('settings')}
              aria-label="Minha conta"
            >
              {store.session?.user.email?.slice(0, 2).toUpperCase() ?? 'VC'}
            </button>
          </div>
        </header>
        <main className={page === 'settings' ? 'settings-page' : undefined}>
          <div className="page-heading">
            <div>
              <div className="today-label">
                <CalendarDays size={14} />
                {currentDate}
              </div>
              <h1>{titles[page][0]}</h1>
              <p>{titles[page][1]}</p>
            </div>
            {page !== 'settings' && (
              <button
                className="button primary"
                disabled={!store.ready || store.conflict}
                onClick={() =>
                  setEditor({
                    kind: page === 'routine' ? 'task' : page === 'finances' ? 'entry' : 'goal',
                  })
                }
              >
                <Plus size={18} />
                {page === 'routine'
                  ? 'Nova atividade'
                  : page === 'finances'
                    ? 'Novo lançamento'
                    : 'Nova meta'}
              </button>
            )}
          </div>
          {store.error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={19} />
              <span>{store.error}</span>
              {store.session && (
                <button
                  className="text-button"
                  onClick={
                    store.conflict
                      ? reloadCloud
                      : () => {
                          if (store.ready) void store.sync()
                          else store.reload()
                        }
                  }
                >
                  {store.conflict ? 'Carregar versão atual' : 'Tentar sincronizar'}
                </button>
              )}
              <button className="icon-button" aria-label="Fechar aviso" onClick={store.clearError}>
                <X size={17} />
              </button>
            </div>
          )}
          {store.data.example && (
            <div className="example-banner">
              <span>
                <Sparkles size={15} />
                <strong>Um exemplo para inspirar.</strong> Edite os dados ou comece com seu próprio
                plano.
              </span>
              <button onClick={reset} disabled={!store.ready}>
                Começar do zero <ArrowRight size={14} />
              </button>
            </div>
          )}
          <fieldset
            className="workspace-content"
            disabled={(!store.ready || store.conflict) && page !== 'settings'}
          >
            {!store.ready && page !== 'settings' ? (
              <div className="loading-panel">
                <LoaderCircle className="spin" size={26} />
                <p>Carregando seu espaço…</p>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => navigate('settings')}
                >
                  Abrir configurações
                </button>
              </div>
            ) : page === 'overview' ? (
              <Overview
                data={store.data}
                update={store.update}
                onPage={navigate}
                onEdit={setEditor}
              />
            ) : page === 'routine' ? (
              <Routine
                data={store.data}
                update={store.update}
                onEdit={setEditor}
                onDelete={deleteTask}
              />
            ) : page === 'finances' ? (
              <Finances
                data={store.data}
                update={store.update}
                onEdit={setEditor}
                onDelete={deleteEntry}
              />
            ) : page === 'goals' ? (
              <Goals
                data={store.data}
                update={store.update}
                onEdit={setEditor}
                onDelete={deleteGoal}
              />
            ) : (
              <SettingsPage
                data={store.data}
                sessionEmail={store.session?.user.email}
                onReload={reloadCloud}
                onReset={reset}
                onImport={(imported) =>
                  setConfirmation({
                    title: 'Restaurar este backup?',
                    detail: `O backup tem ${imported.tasks.length} atividades, ${imported.entries.length} lançamentos e ${imported.goals.length} metas. Os dados atuais serão substituídos.`,
                    action: 'Restaurar backup',
                    run: () => {
                      store.update(() => imported)
                      notify('Backup restaurado.')
                    },
                  })
                }
              />
            )}
          </fieldset>
          <footer className="main-footer">
            <span>Feito para o seu próximo passo.</span>
            <span>
              viachat<span className="brand-dot">.</span>
            </span>
          </footer>
        </main>
      </div>
      {editor && (
        <EditorDialog editor={editor} onClose={() => setEditor(null)} update={store.update} />
      )}
      {confirmation && (
        <Dialog
          title={confirmation.title}
          action={confirmation.action}
          onClose={() => setConfirmation(null)}
          onSubmit={(e) => {
            e.preventDefault()
            confirmation.run()
            setConfirmation(null)
          }}
        >
          <p className="confirmation-detail">{confirmation.detail}</p>
        </Dialog>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </div>
  )
}
