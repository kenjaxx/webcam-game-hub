import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, setDoc, updateDoc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const ROOM_COLLECTION = 'pong_rooms';

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const emptySide = () => ({ paddleY: 180, score: 0, lives: 5 });

export function useRoom() {
  const [room, setRoom] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [role, setRole] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const unsubscribeRef = useRef(null);

  const subscribe = useCallback((id) => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = onSnapshot(
      doc(db, ROOM_COLLECTION, id),
      (snap) => {
        if (!snap.exists()) {
          setConnectionError('This game room no longer exists.');
          setRoom(null);
          return;
        }
        setConnectionError(null);
        setRoom(snap.data());
      },
      (err) => {
        console.error('Room subscription error:', err);
        setConnectionError('Lost connection to the game room.');
      }
    );
  }, []);

  const createRoom = useCallback(async (difficulty) => {
    const id = generateRoomCode();
    await setDoc(doc(db, ROOM_COLLECTION, id), {
      status: 'waiting',
      difficulty,
      host: emptySide(),
      guest: null,
      ball: null,
      winner: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setRoomId(id);
    setRole('host');
    subscribe(id);
    return id;
  }, [subscribe]);

  const joinRoom = useCallback(async (id) => {
    const ref = doc(db, ROOM_COLLECTION, id);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('not-found');
        const data = snap.data();
        if (data.guest) throw new Error('full');
        tx.update(ref, {
          guest: emptySide(),
          status: 'countdown',
          updatedAt: serverTimestamp(),
        });
      });
      setRoomId(id);
      setRole('guest');
      subscribe(id);
      return true;
    } catch (err) {
      console.error('Failed to join room:', err);
      setConnectionError(
        err.message === 'full'
          ? 'This game already has two players.'
          : 'Could not join this game — the link may be invalid or expired.'
      );
      return false;
    }
  }, [subscribe]);

  const updatePaddle = useCallback((forRole, paddleY) => {
    if (!roomId) return;
    updateDoc(doc(db, ROOM_COLLECTION, roomId), {
      [`${forRole}.paddleY`]: paddleY,
      updatedAt: serverTimestamp(),
    }).catch((err) => console.error('Paddle update failed:', err));
  }, [roomId]);

  const updateGameState = useCallback((partial) => {
    if (!roomId) return;
    updateDoc(doc(db, ROOM_COLLECTION, roomId), {
      ...partial,
      updatedAt: serverTimestamp(),
    }).catch((err) => console.error('Game state update failed:', err));
  }, [roomId]);

  const startPlaying = useCallback((ball) => {
    updateGameState({ status: 'playing', ball });
  }, [updateGameState]);

  const leaveRoom = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setRoom(null);
    setRoomId(null);
    setRole(null);
  }, []);

  useEffect(() => () => unsubscribeRef.current?.(), []);

  return {
    room,
    roomId,
    role,
    connectionError,
    createRoom,
    joinRoom,
    updatePaddle,
    updateGameState,
    startPlaying,
    leaveRoom,
  };
}