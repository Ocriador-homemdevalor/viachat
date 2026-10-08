export type Task = {
  id: string
  title: string
  date: string
  time: string
  area: string
  priority: 'Baixa' | 'Média' | 'Alta'
  status: 'A fazer' | 'Em andamento' | 'Concluído'
}
export type Entry = {
  id: string
  description: string
  date: string
  category: string
  kind: 'Entrada' | 'Saída'
  amount: number
}
export type Step = { id: string; title: string; done: boolean }
export type Goal = {
  id: string
  name: string
  target: number
  current: number
  unit: 'R$' | 'unidades'
  deadline: string
  reason: string
  steps: Step[]
}
export type Workspace = {
  version: 1
  example: boolean
  tasks: Task[]
  entries: Entry[]
  goals: Goal[]
}
export const id = () => crypto.randomUUID()
export const today = () => localDate(new Date())
export function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
export const number = (value: number) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)
export const goalValue = (value: number, goal: Goal) =>
  goal.unit === 'R$' ? money(value) : `${number(value)} un.`
export const progress = (goal: Goal) =>
  goal.target > 0 ? Math.min(100, Math.max(0, (goal.current / goal.target) * 100)) : 0
export const remaining = (goal: Goal) => Math.max(0, goal.target - goal.current)
export const emptyWorkspace = (): Workspace => ({
  version: 1,
  example: false,
  tasks: [],
  entries: [],
  goals: [],
})
export function exampleWorkspace(): Workspace {
  const date = today()
  const deadline = localDate(
    new Date(new Date().getFullYear(), new Date().getMonth() + 3, new Date().getDate()),
  )
  return {
    version: 1,
    example: true,
    tasks: [
      {
        id: id(),
        title: 'Planejar as prioridades do dia',
        date,
        time: '08:00',
        area: 'Pessoal',
        priority: 'Alta',
        status: 'Concluído',
      },
      {
        id: id(),
        title: 'Trabalhar no meu projeto',
        date,
        time: '09:00',
        area: 'Trabalho',
        priority: 'Alta',
        status: 'Em andamento',
      },
      {
        id: id(),
        title: 'Fazer uma caminhada',
        date,
        time: '17:30',
        area: 'Saúde',
        priority: 'Média',
        status: 'A fazer',
      },
      {
        id: id(),
        title: 'Ler 20 páginas',
        date,
        time: '20:00',
        area: 'Estudos',
        priority: 'Baixa',
        status: 'A fazer',
      },
    ],
    entries: [
      {
        id: id(),
        description: 'Salário',
        date,
        kind: 'Entrada',
        category: 'Trabalho',
        amount: 4800,
      },
      {
        id: id(),
        description: 'Projeto extra',
        date,
        kind: 'Entrada',
        category: 'Freelance',
        amount: 850,
      },
      { id: id(), description: 'Aluguel', date, kind: 'Saída', category: 'Moradia', amount: 1200 },
      {
        id: id(),
        description: 'Supermercado',
        date,
        kind: 'Saída',
        category: 'Alimentação',
        amount: 420,
      },
      {
        id: id(),
        description: 'Transporte',
        date,
        kind: 'Saída',
        category: 'Transporte',
        amount: 180,
      },
    ],
    goals: [
      {
        id: id(),
        name: 'Minha reserva de emergência',
        target: 12000,
        current: 4200,
        unit: 'R$',
        deadline,
        reason: 'Ter tranquilidade para lidar com imprevistos.',
        steps: [
          { id: id(), title: 'Definir quanto posso guardar por mês', done: true },
          { id: id(), title: 'Separar R$ 650 por mês', done: false },
          { id: id(), title: 'Revisar os gastos toda semana', done: false },
        ],
      },
      {
        id: id(),
        name: 'Ler 12 livros',
        target: 12,
        current: 5,
        unit: 'unidades',
        deadline,
        reason: 'Aprender um pouco todos os dias.',
        steps: [
          { id: id(), title: 'Escolher os próximos livros', done: true },
          { id: id(), title: 'Reservar 20 minutos por dia', done: false },
        ],
      },
      {
        id: id(),
        name: 'Viagem dos sonhos',
        target: 6000,
        current: 1800,
        unit: 'R$',
        deadline,
        reason: 'Conhecer um lugar novo e descansar.',
        steps: [
          { id: id(), title: 'Pesquisar os custos da viagem', done: true },
          { id: id(), title: 'Criar uma reserva mensal para viajar', done: false },
        ],
      },
    ],
  }
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && value.length <= 5000
const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e12
const validDate = (value: unknown) =>
  typeof value === 'string' &&
  (value === '' ||
    (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(new Date(`${value}T12:00:00`).getTime()) &&
      localDate(new Date(`${value}T12:00:00`)) === value))
const uniqueIds = (rows: { id: string }[]) =>
  new Set(rows.map((row) => row.id)).size === rows.length
export function isWorkspace(value: unknown): value is Workspace {
  if (!record(value) || value.version !== 1 || typeof value.example !== 'boolean') return false
  if (!Array.isArray(value.tasks) || !Array.isArray(value.entries) || !Array.isArray(value.goals))
    return false
  if ([value.tasks, value.entries, value.goals].some((rows) => rows.length > 10000)) return false
  const tasksValid = value.tasks.every(
    (t) =>
      record(t) &&
      text(t.id) &&
      text(t.title) &&
      validDate(t.date) &&
      typeof t.time === 'string' &&
      (t.time === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(t.time)) &&
      text(t.area) &&
      ['Baixa', 'Média', 'Alta'].includes(t.priority as string) &&
      ['A fazer', 'Em andamento', 'Concluído'].includes(t.status as string),
  )
  const entriesValid = value.entries.every(
    (e) =>
      record(e) &&
      text(e.id) &&
      text(e.description) &&
      validDate(e.date) &&
      text(e.category) &&
      ['Entrada', 'Saída'].includes(e.kind as string) &&
      positive(e.amount),
  )
  const goalsValid = value.goals.every(
    (g) =>
      record(g) &&
      text(g.id) &&
      text(g.name) &&
      positive(g.target) &&
      g.target > 0 &&
      positive(g.current) &&
      ['R$', 'unidades'].includes(g.unit as string) &&
      validDate(g.deadline) &&
      text(g.reason) &&
      Array.isArray(g.steps) &&
      g.steps.length <= 1000 &&
      g.steps.every(
        (s) => record(s) && text(s.id) && text(s.title) && typeof s.done === 'boolean',
      ) &&
      uniqueIds(g.steps as Step[]),
  )
  return (
    tasksValid &&
    entriesValid &&
    goalsValid &&
    [value.tasks, value.entries, value.goals].every(uniqueIds)
  )
}
export function totals(entries: Entry[], month: string) {
  const selected = entries.filter((e) => e.date.startsWith(month))
  const income = selected
    .filter((e) => e.kind === 'Entrada')
    .reduce((total, e) => total + e.amount, 0)
  const expenses = selected
    .filter((e) => e.kind === 'Saída')
    .reduce((total, e) => total + e.amount, 0)
  return { income, expenses, balance: income - expenses }
}
