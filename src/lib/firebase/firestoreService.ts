
import { db, auth } from './config';
import { doc, setDoc, getDoc, collection, addDoc, query, where, getDocs, serverTimestamp, Timestamp, updateDoc, arrayUnion } from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import type { UserProfile } from '@/interfaces/User';
import type { Organization } from '@/interfaces/Organization';

// Function to generate a simple random alphanumeric invite code
const generateInviteCode = (length: number = 8): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

export const createUserDocument = async (user: FirebaseUser, displayNameFromSignup?: string): Promise<void> => {
  if (!db) {
    console.error("[firestoreService] Firestore (db) is not initialized in createUserDocument. Check Firebase configuration.");
    throw new Error("Firestore (db) is not initialized. Check Firebase configuration.");
  }
  if (!user) {
    console.error("[firestoreService] User object is missing in createUserDocument.");
    throw new Error("User object is missing.");
  }

  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  console.log(`[firestoreService] Attempting to get/create document at path: ${userPath}`);
  try {
    const userDoc = await getDoc(userRef);
    const effectiveDisplayName = displayNameFromSignup || user.displayName || user.email?.split('@')[0] || 'Anonymous User';

    if (!userDoc.exists()) {
      console.log(`[firestoreService] User document does not exist at ${userPath}. Creating with displayName: ${effectiveDisplayName}`);
      const userProfile: UserProfile = {
        uid: user.uid,
        email: user.email,
        displayName: effectiveDisplayName,
        organizationId: null,
        role: null,
        createdAt: new Date(),
      };
      await setDoc(userRef, userProfile);
      console.log(`[firestoreService] Successfully created document at path: ${userPath}`);
    } else {
      const existingProfile = userDoc.data() as UserProfile;
      let needsUpdate = false;
      const updates: Partial<UserProfile> = {};

      // Prioritize displayName from signup/Auth profile if it's different or more complete
      if (effectiveDisplayName && effectiveDisplayName !== existingProfile.displayName) {
        updates.displayName = effectiveDisplayName;
        needsUpdate = true;
      }
      // Ensure email is up-to-date if it changed in Auth (though less common)
      if (user.email && user.email !== existingProfile.email) {
        updates.email = user.email;
        needsUpdate = true;
      }

      if (needsUpdate) {
        console.log(`[firestoreService] User document exists at ${userPath}. Updating displayName to: ${effectiveDisplayName}`);
        await updateDoc(userRef, updates);
        console.log(`[firestoreService] Successfully updated document at path: ${userPath}`);
      } else {
        console.log(`[firestoreService] User document exists at ${userPath}. No new displayName to update or displayName matches.`);
      }
    }
  } catch (error) {
    console.error(`[firestoreService] Firestore error during get/set/update Doc at path: ${userPath}`, error);
    throw error;
  }
};

export const createOrganizationWithInviteCode = async (
  userId: string,
  orgName: string
): Promise<Organization> => {
  if (!db) {
    console.error("[firestoreService] Firestore (db) is not initialized for createOrganizationWithInviteCode.");
    throw new Error("Firestore (db) is not initialized.");
  }
  if (!auth) {
     console.error("[firestoreService] Firebase Auth is not initialized for createOrganizationWithInviteCode.");
     throw new Error("Firebase Auth is not initialized.");
  }
  if (!userId || !orgName) {
    console.error("[firestoreService] Missing userId or orgName for creating organization.");
    throw new Error("Missing userId or orgName for creating organization.");
  }

  const inviteCode = generateInviteCode(8);
  const organizationsPath = 'organizations';
  const organizationsRef = collection(db, organizationsPath);

  console.log(`[firestoreService] Attempting to add document to collection: ${organizationsPath}`);
  try {
    const newOrgDocRef = await addDoc(organizationsRef, {
      name: orgName.trim(),
      ownerUid: userId,
      inviteCode: inviteCode,
      createdAt: serverTimestamp(),
      memberUids: [userId],
    });
    console.log(`[firestoreService] Successfully added organization document with ID: ${newOrgDocRef.id}`);

    const userPath = `users/${userId}`;
    const userRef = doc(db, 'users', userId);
    console.log(`[firestoreService] Attempting to update document at path: ${userPath} (setting organizationId and role)`);
    await updateDoc(userRef, {
      organizationId: newOrgDocRef.id,
      role: 'owner',
    });
    console.log(`[firestoreService] Successfully updated user document at path: ${userPath}`);

    const createdOrgDocPath = `organizations/${newOrgDocRef.id}`;
    console.log(`[firestoreService] Attempting to get created organization document at path: ${createdOrgDocPath}`);
    const createdOrgDoc = await getDoc(newOrgDocRef);
    const orgData = createdOrgDoc.data();

    if (!orgData) {
      console.error(`[firestoreService] Failed to retrieve created organization data from path: ${createdOrgDocPath}`);
      throw new Error("Failed to retrieve created organization data.");
    }
    console.log(`[firestoreService] Successfully retrieved created organization data from path: ${createdOrgDocPath}`);

    return {
      id: newOrgDocRef.id,
      name: orgData.name,
      ownerUid: orgData.ownerUid,
      inviteCode: orgData.inviteCode,
      createdAt: (orgData.createdAt as Timestamp)?.toDate() || new Date(),
    };

  } catch (addError) {
    console.error(`[firestoreService] Error creating organization in Firestore at collection: ${organizationsPath}`, addError);
    throw addError;
  }
};

export const joinOrganizationWithInviteCode = async (
  userId: string,
  inviteCode: string
): Promise<Organization | null> => {
  if (!db) {
    console.error("[firestoreService] Firestore (db) is not initialized for joinOrganizationWithInviteCode.");
    throw new Error("Firestore (db) is not initialized.");
  }
  if (!auth) {
     console.error("[firestoreService] Firebase Auth is not initialized for joinOrganizationWithInviteCode.");
     throw new Error("Firebase Auth is not initialized.");
  }
   if (!userId || !inviteCode) {
    console.error("[firestoreService] Missing userId or inviteCode for joining organization.");
    throw new Error("Missing userId or inviteCode for joining organization.");
  }

  const organizationsPath = 'organizations';
  const organizationsRef = collection(db, organizationsPath);
  const q = query(organizationsRef, where("inviteCode", "==", inviteCode.trim().toUpperCase()));

  console.log(`[firestoreService] Attempting to query collection: ${organizationsPath} for inviteCode: ${inviteCode.trim().toUpperCase()}`);
  try {
    const querySnapshot = await getDocs(q);
    console.log(`[firestoreService] Successfully queried organizations. Found: ${querySnapshot.size} match(es).`);
    if (querySnapshot.empty) {
      console.log("[firestoreService] No organization found with this invite code.");
      return null;
    }

    const orgDoc = querySnapshot.docs[0];
    const organizationId = orgDoc.id;
    const organizationData = orgDoc.data() as Omit<Organization, 'id' | 'createdAt'> & { createdAt: Timestamp; memberUids?: string[] };

    const userPath = `users/${userId}`;
    const userRef = doc(db, 'users', userId);
    console.log(`[firestoreService] Attempting to update document at path: ${userPath} (setting organizationId and role for join)`);
    await updateDoc(userRef, {
      organizationId: organizationId,
      role: 'member',
    });
    console.log(`[firestoreService] Successfully updated user document at path: ${userPath}`);

    const orgDocRefToUpdate = doc(db, 'organizations', organizationId);
    console.log(`[firestoreService] Attempting to update document at path: organizations/${organizationId} (adding memberUid)`);
    await updateDoc(orgDocRefToUpdate, {
      memberUids: arrayUnion(userId)
    });
    console.log(`[firestoreService] Successfully updated organization members at path: organizations/${organizationId}`);

    return {
      id: organizationId,
      name: organizationData.name,
      ownerUid: organizationData.ownerUid,
      inviteCode: organizationData.inviteCode,
      createdAt: organizationData.createdAt.toDate(),
    };
  } catch (queryError) {
    console.error(`[firestoreService] Firestore error during query for invite code in ${organizationsPath}`, queryError);
    throw queryError;
  }
};

export const getUserOrganizationDetails = async (
  userId: string
): Promise<{ organization: Organization | null; userRole: UserProfile['role']; userDisplayName: string } | null> => {
  if (!db) {
    console.error("[firestoreService] Firestore (db) is not initialized for getUserOrganizationDetails.");
    return null; // Return null if db not initialized, to prevent further errors.
  }
  if (!auth) {
    console.error("[firestoreService] Firebase Auth is not initialized for getUserOrganizationDetails.");
     return null;
  }
  if (!userId) {
    console.warn("[firestoreService] No userId provided to getUserOrganizationDetails");
    return null;
  }

  const userPath = `users/${userId}`;
  const userRef = doc(db, 'users', userId);
  console.log(`[firestoreService] Attempting to get user document at path: ${userPath} (for org details)`);
  try {
    let userDoc = await getDoc(userRef);
    console.log(`[firestoreService] Successfully got user document at path: ${userPath}. Exists: ${userDoc.exists()}`);

    let userProfile: UserProfile;
    let userDisplayName: string;

    if (!userDoc.exists()) {
      console.log(`[firestoreService] User document not found for UID: ${userId} at path ${userPath}. Attempting to create it if current user matches.`);
      const currentFirebaseUser = auth.currentUser;
      if (currentFirebaseUser && currentFirebaseUser.uid === userId) {
          await createUserDocument(currentFirebaseUser, currentFirebaseUser.displayName || undefined);
          userDoc = await getDoc(userRef);
          console.log(`[firestoreService] Re-checked user document at path: ${userPath} after creation attempt. Exists: ${userDoc.exists()}`);
          if (!userDoc.exists()) {
            console.error(`[firestoreService] Failed to create and retrieve user document for UID: ${userId}`);
            return null;
          }
          userProfile = userDoc.data() as UserProfile;
      } else {
        console.warn(`[firestoreService] No authenticated user or UID mismatch for ${userId}, cannot create missing user document.`);
        return null;
      }
    } else {
      userProfile = userDoc.data() as UserProfile;
    }

    userDisplayName = userProfile.displayName || userProfile.email?.split('@')[0] || 'User';


    if (!userProfile.organizationId) {
      console.log(`[firestoreService] User ${userId} (${userDisplayName}) is not part of an organization.`);
      return { organization: null, userRole: userProfile.role, userDisplayName };
    }

    const orgPath = `organizations/${userProfile.organizationId}`;
    const orgRef = doc(db, 'organizations', userProfile.organizationId);
    console.log(`[firestoreService] Attempting to get organization document at path: ${orgPath}`);
    const orgDoc = await getDoc(orgRef);
    console.log(`[firestoreService] Successfully got organization document at path: ${orgPath}. Exists: ${orgDoc.exists()}`);

    if (!orgDoc.exists()) {
      console.warn(`[firestoreService] Organization document not found for ID: ${userProfile.organizationId} at path ${orgPath}. This might indicate data inconsistency.`);
      return { organization: null, userRole: userProfile.role, userDisplayName };
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
      userDisplayName: userDisplayName,
    };

  } catch (error) {
    console.error(`[firestoreService] Error during getUserOrganizationDetails for user ${userId}:`, error);
    if (error instanceof Error && (error.message.includes("firestore/permission-denied") || error.message.includes("Missing or insufficient permissions"))) {
        console.error("[firestoreService] Firestore permission denied. Check your Firestore security rules in the Firebase console.");
    }
    // Attempt to return at least displayName if other parts fail
    try {
        const userRefFallback = doc(db, 'users', userId);
        const userDocFallback = await getDoc(userRefFallback);
        if(userDocFallback.exists()){
            const profile = userDocFallback.data() as UserProfile;
            return { organization: null, userRole: profile.role, userDisplayName: profile.displayName || profile.email?.split('@')[0] || 'User' }
        }
    } catch (fallbackError) {
        console.error("[firestoreService] Error during fallback to get user display name:", fallbackError);
    }
    return null; // Or throw error, depending on desired error handling
  }
};


export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  if (!db) {
    console.error("[firestoreService] Firestore (db) is not initialized for getUserProfile.");
    throw new Error("Firestore (db) is not initialized.");
  }
  if (!userId) {
    console.warn("[firestoreService] No userId provided to getUserProfile");
    return null;
  }
  const userPath = `users/${userId}`;
  const userRef = doc(db, 'users', userId);
  console.log(`[firestoreService] Attempting to get user profile at path: ${userPath}`);
  try {
    const userDoc = await getDoc(userRef);
    console.log(`[firestoreService] Successfully got user profile at path: ${userPath}. Exists: ${userDoc.exists()}`);
    if (!userDoc.exists()) return null;

    const profile = userDoc.data() as UserProfile;
    // Ensure displayName is sensible if somehow missing
    if (!profile.displayName) {
        profile.displayName = profile.email?.split('@')[0] || 'User';
    }
    return profile;

  } catch (error) {
    console.error(`[firestoreService] Firestore error during getDoc for user profile at path: ${userPath}`, error);
    throw error;
  }
};

export const addMemberToOrganization = async (orgId: string, userId: string): Promise<void> => {
    if (!db) {
        console.error("[firestoreService] Firestore (db) is not initialized for addMemberToOrganization.");
        throw new Error("Firestore (db) is not initialized.");
    }
    if (!orgId || !userId) {
        console.error("[firestoreService] Missing orgId or userId for adding member to organization.");
        throw new Error("Missing orgId or userId.");
    }

    const orgRef = doc(db, 'organizations', orgId);
    console.log(`[firestoreService] Attempting to add member ${userId} to organization ${orgId}`);
    try {
        await updateDoc(orgRef, {
            memberUids: arrayUnion(userId)
        });
        console.log(`[firestoreService] Successfully added member ${userId} to organization ${orgId}`);
    } catch (error) {
        console.error(`[firestoreService] Error adding member ${userId} to organization ${orgId}:`, error);
        throw error;
    }
};
