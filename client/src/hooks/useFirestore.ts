import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  type QueryConstraint,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/services/firebase';

// Generic Firestore CRUD hooks

export function useFirestoreDocument<T extends DocumentData>(
  collectionName: string,
  docId: string | null
) {
  const [data, setData] = useState<(T & { id: string }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!docId) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const docRef = doc(db, collectionName, docId);
    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          setData({ id: snap.id, ...snap.data() } as T & { id: string });
        } else {
          setData(null);
        }
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, docId]);

  return { data, isLoading, error };
}

export function useFirestoreCollection<T extends DocumentData>(
  collectionName: string,
  constraints: QueryConstraint[] = []
) {
  const [data, setData] = useState<(T & { id: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, collectionName), ...constraints);
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as (T & { id: string })[];
        setData(docs);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName]);

  return { data, isLoading, error };
}

export function useFirestoreCRUD<T extends DocumentData>(collectionName: string) {
  const create = useCallback(async (data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>) => {
    const ref = await addDoc(collection(db, collectionName), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }, [collectionName]);

  const update = useCallback(async (id: string, data: Partial<T>) => {
    await updateDoc(doc(db, collectionName, id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }, [collectionName]);

  const remove = useCallback(async (id: string) => {
    await deleteDoc(doc(db, collectionName, id));
  }, [collectionName]);

  const getById = useCallback(async (id: string): Promise<(T & { id: string }) | null> => {
    const snap = await getDoc(doc(db, collectionName, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as T & { id: string };
  }, [collectionName]);

  const getAll = useCallback(async (constraints: QueryConstraint[] = []): Promise<(T & { id: string })[]> => {
    const q = query(collection(db, collectionName), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as (T & { id: string })[];
  }, [collectionName]);

  return { create, update, remove, getById, getAll };
}

// Convenient constraint builders
export { where, orderBy, limit };
