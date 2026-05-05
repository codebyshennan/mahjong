import { useEffect, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import type { Query } from 'firebase/firestore'

export interface CollectionEntry<T> {
  id: string
  data: T
}

/**
 * Subscribe to a Firestore query. Returns the docs as `{id, data}[]`
 * along with `loading` (true until the first snapshot) and any `error`.
 *
 * IMPORTANT: pass the query through `useMemo` from the caller — recreating
 * a Query on every render will cause re-subscriptions.
 */
export function useCollection<T>(query: Query | null) {
  const [items, setItems] = useState<CollectionEntry<T>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!query) {
      setItems([])
      setLoading(false)
      return
    }
    const unsub = onSnapshot(
      query,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, data: d.data() as T })))
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
    return unsub
  }, [query])

  return { items, loading, error }
}
