import {
  collection,
  doc,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type FirestoreDataConverter,
} from 'firebase/firestore';
import { COLLECTIONS } from '../constants/collections';
import type { FoodItem, Order, Store, User } from '../types/models';
import { db } from './firebaseConfig';

/**
 * 서버 타임스탬프(serverTimestamp())가 아직 확정되지 않은 로컬 스냅샷에서도
 * null 대신 추정값이 오도록 해 화면 코드가 항상 Timestamp 를 받게 한다.
 */
function converter<T>(): FirestoreDataConverter<T, DocumentData> {
  return {
    toFirestore: (data) => data as DocumentData,
    fromFirestore: (snap, options) => snap.data({ ...options, serverTimestamps: 'estimate' }) as T,
  };
}

const typedCollection = <T>(path: string) =>
  collection(db, path).withConverter(converter<T>()) as CollectionReference<T, DocumentData>;
const typedDoc =
  <T>(path: string) =>
  (id: string) =>
    doc(db, path, id).withConverter(converter<T>()) as DocumentReference<T, DocumentData>;

export const usersCol = typedCollection<User>(COLLECTIONS.users);
export const storesCol = typedCollection<Store>(COLLECTIONS.stores);
export const foodItemsCol = typedCollection<FoodItem>(COLLECTIONS.foodItems);
export const ordersCol = typedCollection<Order>(COLLECTIONS.orders);

export const userDoc = typedDoc<User>(COLLECTIONS.users);
export const storeDoc = typedDoc<Store>(COLLECTIONS.stores);
export const foodItemDoc = typedDoc<FoodItem>(COLLECTIONS.foodItems);
export const orderDoc = typedDoc<Order>(COLLECTIONS.orders);
