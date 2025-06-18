
import { db, auth } from './config';
import { doc, setDoc, getDoc, collection, addDoc, query, where, getDocs, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import type { UserProfile } from '@/interfaces/User';
import type { Organization } from '@/interfaces/Organization';

// Function to generate a simple random alphanumeric invite code
const generateInviteCode = (length: number = 6): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

export const createUserDocument = async (user: FirebaseUser): Promise<void> => {
  if (!db || !user) return;
  const userRef = doc(db, 'users', user.uid);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) {
    try {
      const userProfile: Partial<UserProfile> = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0],
        organizationId: null,
        role: null,
        createdAt: new Date(), 
      };
      await setDoc(userRef, userProfile);
    } catch (error) {
      console.error("Error creating user document:", error);
      throw error;
    }
  }
};

export const createOrganizationWithInviteCode = async (
  userId: string,
  orgName: string
): Promise<Organization> => {
  if (!db || !userId || !orgName) {
    throw new Error("Firestore not initialized or missing parameters");
  }

  const inviteCode = generateInviteCode(6);
  const organizationsRef = collection(db, 'organizations');
  
  try {
    const newOrgDocRef = await addDoc(organizationsRef, {
      name: orgName,
      ownerUid: userId,
      inviteCode: inviteCode,
      createdAt: serverTimestamp(),
    });

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      organizationId: newOrgDocRef.id,
      role: 'owner',
    });
    
    return {
      id: newOrgDocRef.id,
      name: orgName,
      ownerUid: userId,
      inviteCode: inviteCode,
      createdAt: new Date() // serverTimestamp will be resolved on server
    };
  } catch (error) {
    console.error("Error creating organization:", error);
    throw error;
  }
};

export const joinOrganizationWithInviteCode = async (
  userId: string,
  inviteCode: string
): Promise<Organization | null> => {
  if (!db || !userId || !inviteCode) {
    throw new Error("Firestore not initialized or missing parameters");
  }

  const organizationsRef = collection(db, 'organizations');
  const q = query(organizationsRef, where("inviteCode", "==", inviteCode.toUpperCase()));

  try {
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      console.log("No organization found with this invite code.");
      return null;
    }

    const orgDoc = querySnapshot.docs[0];
    const organizationId = orgDoc.id;
    const organizationData = orgDoc.data() as Omit<Organization, 'id' | 'createdAt'> & { createdAt: Timestamp };


    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      organizationId: organizationId,
      role: 'member',
    });

    return {
      id: organizationId,
      name: organizationData.name,
      ownerUid: organizationData.ownerUid,
      inviteCode: organizationData.inviteCode,
      createdAt: organizationData.createdAt.toDate(),
    };
  } catch (error) {
    console.error("Error joining organization:", error);
    throw error;
  }
};

export const getUserOrganizationDetails = async (
  userId: string
): Promise<{ organization: Organization; userRole: UserProfile['role'] } | null> => {
  if (!db || !userId) {
    console.warn("Firestore not initialized or no userId provided to getUserOrganizationDetails");
    return null;
  }

  const userRef = doc(db, 'users', userId);
  try {
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      console.log("User document not found for UID:", userId);
      // Potentially create it here if it's missing and user is authenticated
      if (auth?.currentUser?.uid === userId) {
        await createUserDocument(auth.currentUser);
        const newUserDoc = await getDoc(userRef);
        if (newUserDoc.exists()) {
          const newUserProfile = newUserDoc.data() as UserProfile;
           if (!newUserProfile.organizationId) return null; // Still no org
        } else {
          return null;
        }
      } else {
        return null;
      }
    }
    
    const userProfile = userDoc.data() as UserProfile;

    if (!userProfile.organizationId) {
      // console.log("User is not part of an organization.");
      return null;
    }

    const orgRef = doc(db, 'organizations', userProfile.organizationId);
    const orgDoc = await getDoc(orgRef);

    if (!orgDoc.exists()) {
      console.warn("Organization document not found for ID:", userProfile.organizationId);
      // This might indicate data inconsistency. Clear user's orgId?
      // await updateDoc(userRef, { organizationId: null, role: null });
      return null;
    }

    const orgData = orgDoc.data() as Omit<Organization, 'id' | 'createdAt'> & { createdAt: Timestamp };
    
    return {
      organization: {
        id: orgDoc.id,
        name: orgData.name,
        ownerUid: orgData.ownerUid,
        inviteCode: orgData.inviteCode,
        createdAt: orgData.createdAt.toDate(),
      },
      userRole: userProfile.role,
    };
  } catch (error) {
    console.error("Error fetching user organization details:", error);
    throw error; // Re-throw to be caught by calling function
  }
};
