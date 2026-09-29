import {
  collection,
  doc,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
} from 'firebase/firestore';
import { COLLECTIONS } from '../constants/collections';
import type { FoodItem, Order, Store, User } from '../types/models';
import { db } from './firebaseConfig';

const typedCollection = <T>(path: string) => collection(db, path) as CollectionReference<T, DocumentData>;
const typedDoc = <T>(path: string) => (id: string) => doc(db, path, id) as DocumentReference<T, DocumentData>;

export const usersCol = typedCollection<User>(COLLECTIONS.users);
export const storesCol = typedCollection<Store>(COLLECTIONS.stores);
export const foodItemsCol = typedCollection<FoodItem>(COLLECTIONS.foodItems);
export const ordersCol = typedCollection<Order>(COLLECTIONS.orders);

export const userDoc = typedDoc<User>(COLLECTIONS.users);
export const storeDoc = typedDoc<Store>(COLLECTIONS.stores);
export const foodItemDoc = typedDoc<FoodItem>(COLLECTIONS.foodItems);
export const orderDoc = typedDoc<Order>(COLLECTIONS.orders);
