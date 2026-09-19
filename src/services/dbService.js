// Database Abstraction Service (Firebase Cloud + LocalStorage Fallback)
import { db, isCloudConnected } from '../firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { initialData } from '../data/initialBank';

const LOCAL_STORAGE_KEY = 'APTIS_MASTER_DB_V1';
const USER_PROGRESS_KEY = 'APTIS_USER_PROGRESS_V1';

// Helper to initialize local DB with seed data if empty
export const initLocalData = () => {
  const existing = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!existing) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialData));
    console.log("💾 Initialized Local DB with seed question bank!");
  }
};

// Get Full DB State
export const getFullBank = async () => {
  initLocalData();
  
  if (isCloudConnected && db) {
    try {
      const testsSnap = await getDocs(collection(db, 'tests'));
      const lisSnap = await getDocs(collection(db, 'listening'));
      const readSnap = await getDocs(collection(db, 'reading'));
      const writSnap = await getDocs(collection(db, 'writing'));
      const spkSnap = await getDocs(collection(db, 'speaking'));

      if (!testsSnap.empty) {
        return {
          tests: testsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          listening: lisSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          reading: readSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          writing: writSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          speaking: spkSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        };
      }
    } catch (e) {
      console.warn("Could not fetch from Firebase Cloud, falling back to Local DB:", e);
    }
  }

  // Local Storage Fallback
  const dataStr = localStorage.getItem(LOCAL_STORAGE_KEY);
  return dataStr ? JSON.parse(dataStr) : initialData;
};

// Filter questions by skill and part number
export const getQuestionsBySkillAndPart = async (skillType, partNumber = 'all') => {
  const fullBank = await getFullBank();
  const skillItems = fullBank[skillType] || [];
  if (partNumber === 'all' || !partNumber) {
    return skillItems;
  }
  return skillItems.filter(item => Number(item.part) === Number(partNumber));
};


// Add Question to specific skill bank
export const addQuestionToBank = async (skillType, questionData) => {
  initLocalData();
  const newId = `${skillType}-${Date.now()}`;
  const newItem = { id: newId, createdAt: new Date().toISOString(), ...questionData };

  // 1. Save locally
  const currentData = await getFullBank();
  if (!currentData[skillType]) currentData[skillType] = [];
  currentData[skillType].push(newItem);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentData));

  // 2. Save to Firebase if connected
  if (isCloudConnected && db) {
    try {
      await addDoc(collection(db, skillType), newItem);
      console.log(`☁️ Added item to Cloud Firebase collection '${skillType}'`);
    } catch (e) {
      console.error("Cloud save failed:", e);
    }
  }

  return newItem;
};

// Delete Question from bank
export const deleteQuestionFromBank = async (skillType, id) => {
  const currentData = await getFullBank();
  if (currentData[skillType]) {
    currentData[skillType] = currentData[skillType].filter(item => item.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentData));
  }
  return true;
};

// Save User Test Results / Progress
export const saveUserProgress = (resultData) => {
  const existingStr = localStorage.getItem(USER_PROGRESS_KEY);
  const history = existingStr ? JSON.parse(existingStr) : [];
  history.unshift({
    id: `history-${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...resultData
  });
  localStorage.setItem(USER_PROGRESS_KEY, JSON.stringify(history));
  return history;
};

// Get User Progress History
export const getUserProgress = () => {
  const existingStr = localStorage.getItem(USER_PROGRESS_KEY);
  return existingStr ? JSON.parse(existingStr) : [];
};

// Reset Local DB to Factory Seed
export const resetToFactorySeed = () => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialData));
  return initialData;
};
