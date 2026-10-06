import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) initializeApp();

export const db = getFirestore();

export const col = {
  users: () => db.collection('users'),
  stores: () => db.collection('stores'),
  foodItems: () => db.collection('food_items'),
  orders: () => db.collection('orders'),
  checkouts: () => db.collection('checkouts'),
  pushEvents: () => db.collection('push_events'),
};
