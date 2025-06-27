
import { db, auth } from './config';
import { doc, setDoc, getDoc, collection, addDoc, query, where, getDocs, serverTimestamp, Timestamp, updateDoc, arrayUnion, writeBatch, deleteDoc, runTransaction } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import type { UserProfile } from '@/interfaces/User';
import type { Organization } from '@/interfaces/Organization';

const generateInviteCode = (length: number = 8): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

export const createUserDocument = async (user: FirebaseUser, displayName: string): Promise<void> => {
  if (!db) throw new Error("Firestore not initialized");
  const userRef = doc(db, 'users', user.uid);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: displayName,
      createdAt: serverTimestamp(),
    });
  }
};

export const createOrganization = async (userId: string, orgName: string): Promise<Organization> => {
    if (!db) throw new Error("Firestore not initialized");
    const inviteCode = generateInviteCode(8);
    const newOrgRef = doc(collection(db, 'organizations'));
    
    const newOrg: Omit<Organization, 'id' | 'createdAt'> = {
        name: orgName.trim(),
        ownerUid: userId,
        inviteCode: inviteCode,
        memberUids: [userId],
    };

    await setDoc(newOrgRef, {
        ...newOrg,
        createdAt: serverTimestamp(),
    });

    const createdDoc = await getDoc(newOrgRef);
    const data = createdDoc.data();

    return {
        id: newOrgRef.id,
        name: data?.name,
        ownerUid: data?.ownerUid,
        inviteCode: data?.inviteCode,
        memberUids: data?.memberUids,
        createdAt: (data?.createdAt as Timestamp)?.toDate() ?? new Date(),
    };
};

export const joinOrganization = async (userId: string, inviteCode: string): Promise<Organization | null> => {
    if (!db) throw new Error("Firestore not initialized");
    const orgsRef = collection(db, 'organizations');
    const q = query(orgsRef, where("inviteCode", "==", inviteCode.trim()));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        return null;
    }

    const orgDoc = querySnapshot.docs[0];
    await updateDoc(orgDoc.ref, {
        memberUids: arrayUnion(userId)
    });
    
    const data = orgDoc.data();
    return {
        id: orgDoc.id,
        name: data.name,
        ownerUid: data.ownerUid,
        inviteCode: data.inviteCode,
        memberUids: [...data.memberUids, userId],
        createdAt: (data.createdAt as Timestamp).toDate(),
    };
};

export const getUserAssociatedOrganizations = async (userId: string): Promise<Organization[]> => {
    if (!db) throw new Error("Firestore not initialized");
    const orgsRef = collection(db, 'organizations');
    const ownedOrgsQuery = query(orgsRef, where("ownerUid", "==", userId));
    const memberOrgsQuery = query(orgsRef, where("memberUids", "array-contains", userId));

    const [ownedSnapshot, memberSnapshot] = await Promise.all([
        getDocs(ownedOrgsQuery),
        getDocs(memberOrgsQuery)
    ]);
    
    const orgsMap = new Map<string, Organization>();
    const processSnapshot = (snapshot: typeof ownedSnapshot) => {
        snapshot.forEach(docSnap => {
            if (!orgsMap.has(docSnap.id)) {
                const data = docSnap.data();
                orgsMap.set(docSnap.id, {
                    id: docSnap.id,
                    name: data.name,
                    ownerUid: data.ownerUid,
                    inviteCode: data.inviteCode,
                    memberUids: data.memberUids,
                    createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
                });
            }
        });
    };
    
    processSnapshot(ownedSnapshot);
    processSnapshot(memberSnapshot);
    
    return Array.from(orgsMap.values());
};

export const getOrganizationMembers = async (orgId: string): Promise<UserProfile[]> => {
    if (!db) throw new Error("Firestore not initialized");

    const orgRef = doc(db, 'organizations', orgId);
    const orgDoc = await getDoc(orgRef);
    if (!orgDoc.exists()) {
        throw new Error("Organization not found.");
    }
    const memberUids = orgDoc.data().memberUids as string[] || [];
    if (memberUids.length === 0) {
        return [];
    }
    const usersRef = collection(db, 'users');
    const membersQuery = query(usersRef, where('uid', 'in', memberUids));
    const membersSnapshot = await getDocs(membersQuery);
    
    return membersSnapshot.docs.map(doc => doc.data() as UserProfile);
};

export const deleteOrganization = async (orgId: string): Promise<void> => {
    if (!db) throw new Error("Firestore not initialized");
    const orgRef = doc(db, 'organizations', orgId);
    await deleteDoc(orgRef);
};
