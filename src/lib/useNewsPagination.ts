import { useCallback, useEffect, useRef, useState } from "react";
import {
  query, orderBy, limit, startAfter, getDocs, CollectionReference,
  Timestamp, QueryDocumentSnapshot,
} from "firebase/firestore";

export interface NewsCore {
  id: string;
  title: string;
  body: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  createdBy: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
}

export function useNewsPagination(colRef: CollectionReference, first = 6, page = 6) {
  const [items, setItems] = useState<NewsCore[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const fetching = useRef(false);

  const fetchPage = useCallback(async (init = false) => {
    if (!hasMore || fetching.current) return;
    fetching.current = true;

    const q = query(
      colRef,
      orderBy("createdAt", "desc"),
      limit(init ? first : page),
      ...(init || !lastDoc ? [] : [startAfter(lastDoc)]),
    );
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as NewsCore);

    setItems(p => (init ? list : [...p, ...list]));
    setLastDoc(snap.docs.at(-1) ?? null);
    setHasMore(snap.docs.length === (init ? first : page));
    fetching.current = false;
  }, [colRef, first, page, hasMore, lastDoc]);

  useEffect(() => { fetchPage(true); }, [fetchPage]);

  return { items, hasMore, fetchNext: () => fetchPage(false) };
}
