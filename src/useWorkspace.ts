import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { cloud } from './cloud'
import { emptyWorkspace, exampleWorkspace, isWorkspace, type Workspace } from './model'

const LOCAL_KEY = 'viachat:workspace:v1'
function readLocal(key: string): Workspace | null {
  try {
    const raw = localStorage.getItem(key)
    const value: unknown = raw ? JSON.parse(raw) : null
    return isWorkspace(value) ? value : null
  } catch {
    return null
  }
}
type Pending = { data: Workspace; timestamp: string }
function readPending(key: string): Pending | null {
  try {
    const value = JSON.parse(localStorage.getItem(`${key}:pending`) ?? 'null')
    return value && isWorkspace(value.data) && typeof value.timestamp === 'string' ? value : null
  } catch {
    return null
  }
}

export function useWorkspace() {
  const [data, setData] = useState<Workspace>(() => readLocal(LOCAL_KEY) ?? exampleWorkspace())
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!cloud)
  const [status, setStatus] = useState('Salvo neste navegador')
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [reload, setReload] = useState(0)
  const state = useRef({
    data,
    revision: 0,
    savedRevision: 0,
    timestamp: '',
    account: '',
    ready: !cloud,
    conflict: false,
    epoch: 0,
  })
  const inFlight = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const account = session?.user.id ?? ''
  const key = account ? `${LOCAL_KEY}:${account}` : LOCAL_KEY

  useEffect(() => {
    if (!cloud) return
    let active = true
    cloud.auth.getSession().then(({ data: result, error: authError }) => {
      if (!active) return
      if (authError) setError('Não foi possível verificar sua sessão. Tente entrar novamente.')
      setSession(result.session)
      if (!result.session) setReady(true)
    })
    const { data: listener } = cloud.auth.onAuthStateChange((_event, next) => {
      if (!active) return
      setSession(next)
      if (!next) setReady(true)
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true
    if (timer.current) clearTimeout(timer.current)
    state.current.account = account
    state.current.ready = false
    state.current.conflict = false
    state.current.revision = 0
    state.current.savedRevision = 0
    state.current.epoch += 1
    setConflict(false)
    setError('')
    if (!account || !cloud) {
      const local = readLocal(LOCAL_KEY) ?? exampleWorkspace()
      state.current.data = local
      state.current.ready = true
      setData(local)
      setReady(true)
      setStatus('Salvo neste navegador')
      return
    }
    setReady(false)
    setStatus('Carregando seus dados…')
    const cached = readPending(key)?.data ?? readLocal(key) ?? emptyWorkspace()
    state.current.data = cached
    setData(cached)
    async function load() {
      try {
        const { data: row, error: fetchError } = await cloud!
          .from('workspaces')
          .select('data,updated_at')
          .eq('user_id', account)
          .maybeSingle()
        if (fetchError) throw fetchError
        if (!active) return
        let loaded: Workspace
        let timestamp: string
        if (row) {
          if (!isWorkspace(row.data)) throw new Error('Formato de dados inválido')
          loaded = row.data
          timestamp = row.updated_at
        } else {
          loaded = readLocal(key) ?? readLocal(LOCAL_KEY) ?? exampleWorkspace()
          const { data: created, error: createError } = await cloud!
            .from('workspaces')
            .insert({ user_id: account, data: loaded })
            .select('updated_at')
            .single()
          if (createError) throw createError
          timestamp = created.updated_at
        }
        if (!active) return
        const pending = readPending(key)
        if (pending) {
          loaded = pending.data
          state.current.revision = 1
          if (pending.timestamp !== timestamp) {
            state.current.conflict = true
            setConflict(true)
            setError(
              'Há uma versão mais recente na nuvem. Exporte seu backup antes de carregar a versão atual.',
            )
          }
        }
        state.current.data = loaded
        state.current.timestamp = timestamp
        state.current.ready = true
        setData(loaded)
        setReady(true)
        setStatus(
          pending
            ? state.current.conflict
              ? 'Alterações em outro dispositivo'
              : 'Sincronização pendente'
            : 'Salvo na nuvem',
        )
      } catch {
        if (!active) return
        setError(
          'Não foi possível carregar a nuvem. Confira a conexão e a configuração do serviço.',
        )
        setStatus('Nuvem indisponível')
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [account, key, reload])

  useEffect(() => {
    if (
      !ready ||
      !state.current.ready ||
      state.current.account !== account ||
      state.current.data !== data
    )
      return
    try {
      localStorage.setItem(key, JSON.stringify(data))
    } catch {
      setError(
        'O navegador não conseguiu salvar os dados. Exporte um backup para não perder suas alterações.',
      )
      if (!account) setStatus('Backup necessário')
    }
  }, [data, key, ready, account])

  const sync = useCallback(async function save() {
    const current = state.current
    if (
      !cloud ||
      !current.account ||
      !current.ready ||
      current.conflict ||
      inFlight.current ||
      current.revision === current.savedRevision
    )
      return
    const accountId = current.account
    const revision = current.revision
    const epoch = current.epoch
    const snapshot = current.data
    const timestamp = current.timestamp
    inFlight.current = true
    setStatus('Sincronizando…')
    try {
      const { data: row, error: saveError } = await cloud
        .from('workspaces')
        .update({ data: snapshot })
        .eq('user_id', accountId)
        .eq('updated_at', timestamp)
        .select('updated_at')
        .maybeSingle()
      if (state.current.account !== accountId || state.current.epoch !== epoch) return
      if (saveError) throw saveError
      if (!row) {
        state.current.conflict = true
        setConflict(true)
        setStatus('Alterações em outro dispositivo')
        setError(
          'Há uma versão mais recente na nuvem. Exporte seu backup antes de carregar a versão atual.',
        )
        return
      }
      state.current.timestamp = row.updated_at
      state.current.savedRevision = revision
      setError('')
      try {
        const localKey = `${LOCAL_KEY}:${accountId}`
        if (state.current.revision === revision) localStorage.removeItem(`${localKey}:pending`)
        else
          localStorage.setItem(
            `${localKey}:pending`,
            JSON.stringify({ data: state.current.data, timestamp: row.updated_at }),
          )
      } catch {
        setError('A cópia local não pôde ser atualizada. Exporte um backup.')
      }
      setStatus('Salvo na nuvem')
    } catch {
      if (state.current.account === accountId && state.current.epoch === epoch) {
        setStatus('Sincronização pendente')
        setError('Suas alterações estão neste navegador. Reconecte-se e use “Tentar sincronizar”.')
      }
    } finally {
      inFlight.current = false
      if (
        (state.current.epoch !== epoch ||
          (state.current.revision > revision && state.current.savedRevision === revision)) &&
        !state.current.conflict
      )
        void save()
    }
  }, [])

  const update = useCallback((change: (workspace: Workspace) => Workspace) => {
    if (!state.current.ready || state.current.conflict) return false
    const next = change(state.current.data)
    if (!isWorkspace(next)) {
      setError(
        'Confira os valores: metas precisam de um total maior que zero e valores não podem ser negativos.',
      )
      return false
    }
    state.current.data = next
    state.current.revision += 1
    setData(next)
    if (state.current.account) {
      setStatus('Sincronizando…')
      try {
        localStorage.setItem(
          `${LOCAL_KEY}:${state.current.account}:pending`,
          JSON.stringify({ data: next, timestamp: state.current.timestamp }),
        )
      } catch {
        setError(
          'Não foi possível salvar uma cópia local. Exporte um backup enquanto a nuvem sincroniza.',
        )
      }
    }
    return true
  }, [])

  useEffect(() => {
    if (!ready || !account || conflict || state.current.revision === state.current.savedRevision)
      return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void sync(), 650)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [data, ready, account, conflict, sync])

  useEffect(() => {
    const retry = () => void sync()
    window.addEventListener('online', retry)
    return () => {
      window.removeEventListener('online', retry)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [sync])

  const reloadCloud = () => {
    try {
      if (account) localStorage.removeItem(`${key}:pending`)
    } catch {
      setError('Não foi possível limpar a versão pendente. Exporte um backup antes de continuar.')
      return
    }
    setReload((n) => n + 1)
  }
  return {
    data,
    update,
    session,
    ready,
    status,
    error,
    conflict,
    sync,
    reload: () => setReload((n) => n + 1),
    discardAndReload: reloadCloud,
    clearError: () => setError(''),
  }
}
