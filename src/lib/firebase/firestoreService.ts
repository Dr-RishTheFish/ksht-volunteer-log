
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
        organizationId: null, // This might represent the "last active" or "primary" org
        role: null,
        createdAt: new Date(),
      };
      await setDoc(userRef, userProfile);
      console.log(`[firestoreService] Successfully created document at path: ${userPath}`);
    } else {
      const existingProfile = userDoc.data() as UserProfile;
      let needsUpdate = false;
      const updates: Partial<UserProfile> = {};

      if (effectiveDisplayName && effectiveDisplayName !== existingProfile.displayName) {
        updates.displayName = effectiveDisplayName;
        needsUpdate = true;
      }
      if (user.email && user.email !== existingProfile.email) {
        updates.email = user.email;
        needsUpdate = true;
      }
      // We don't automatically update organizationId or role here; that's handled by specific org actions.

      if (needsUpdate) {
        console.log(`[firestoreService] User document exists at ${userPath}. Updating profile details.`);
        await updateDoc(userRef, updates);
        console.log(`[firestoreService] Successfully updated document at path: ${userPath}`);
      } else {
        console.log(`[firestoreService] User document exists at ${userPath}. No new details to update or details match.`);
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
  if (!db) throw new Error("[firestoreService] Firestore (db) is not initialized.");
  if (!auth) throw new Error("[firestoreService] Firebase Auth is not initialized.");
  if (!userId || !orgName) throw new Error("[firestoreService] Missing userId or orgName.");

  const inviteCode = generateInviteCode(8);
  const organizationsPath = 'organizations';
  const organizationsRef = collection(db, organizationsPath);

  console.log(`[firestoreService] Creating organization: ${orgName} by user ${userId}`);
  try {
    const newOrgDocRef = await addDoc(organizationsRef, {
      name: orgName.trim(),
      ownerUid: userId,
      inviteCode: inviteCode,
      createdAt: serverTimestamp(),
      memberUids: [userId], // Owner is implicitly a member
    });
    console.log(`[firestoreService] Organization created with ID: ${newOrgDocRef.id}`);

    const userRef = doc(db, 'users', userId);
    // Set this new org as the user's "active" org
    await updateDoc(userRef, {
      organizationId: newOrgDocRef.id,
      role: 'owner',
    });
    console.log(`[firestoreService] User ${userId} set as owner of ${newOrgDocRef.id}`);

    const createdOrgDoc = await getDoc(newOrgDocRef);
    const orgData = createdOrgDoc.data();
    if (!orgData) throw new Error("[firestoreService] Failed to retrieve created organization data.");

    return {
      id: newOrgDocRef.id,
      name: orgData.name,
      ownerUid: orgData.ownerUid,
      inviteCode: orgData.inviteCode,
      createdAt: (orgData.createdAt as Timestamp)?.toDate() || new Date(),
      memberUids: orgData.memberUids || [userId],
    };
  } catch (error) {
    console.error(`[firestoreService] Error creating organization:`, error);
    throw error;
  }
};

export const joinOrganizationWithInviteCode = async (
  userId: string,
  inviteCode: string
): Promise<Organization | null> => {
  if (!db) throw new Error("[firestoreService] Firestore (db) is not initialized.");
  if (!auth) throw new Error("[firestoreService] Firebase Auth is not initialized.");
  if (!userId || !inviteCode) throw new Error("[firestoreService] Missing userId or inviteCode.");

  const organizationsPath = 'organizations';
  const q = query(collection(db, organizationsPath), where("inviteCode", "==", inviteCode.trim().toUpperCase()));

  console.log(`[firestoreService] User ${userId} attempting to join organization with code: ${inviteCode}`);
  try {
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      console.log("[firestoreService] No organization found with this invite code.");
      return null;
    }

    const orgDocSnapshot = querySnapshot.docs[0];
    const organizationId = orgDocSnapshot.id;
    const organizationData = orgDocSnapshot.data() as Omit<Organization, 'id' | 'createdAt'> & { createdAt: Timestamp; memberUids?: string[] };

    const userRef = doc(db, 'users', userId);
    // Set this joined org as the user's "active" org
    await updateDoc(userRef, {
      organizationId: organizationId,
      role: 'member',
    });

    const orgDocRef = doc(db, 'organizations', organizationId);
    await updateDoc(orgDocRef, {
      memberUids: arrayUnion(userId)
    });
    console.log(`[firestoreService] User ${userId} joined organization ${organizationId}`);

    return {
      id: organizationId,
      name: organizationData.name,
      ownerUid: organizationData.ownerUid,
      inviteCode: organizationData.inviteCode,
      createdAt: organizationData.createdAt.toDate(),
      memberUids: [...(organizationData.memberUids || []), userId],
    };
  } catch (error) {
    console.error(`[firestoreService] Error joining organization:`, error);
    throw error;
  }
};

// Gets details for a user's "active" or "primary" organization (stored on user profile)
export const getUserOrganizationDetails = async (
  userId: string
): Promise<{ organization: Organization | null; userRole: UserProfile['role']; userDisplayName: string } | null> => {
  if (!db || !auth || !userId) {
    console.error("[firestoreService] Prerequisites not met for getUserOrganizationDetails (db, auth, or userId missing).");
    return null;
  }
  const userRef = doc(db, 'users', userId);
  console.log(`[firestoreService] Getting user profile for org details: ${userId}`);
  try {
    let userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      const currentFirebaseUser = auth.currentUser;
      if (currentFirebaseUser && currentFirebaseUser.uid === userId) {
        await createUserDocument(currentFirebaseUser, currentFirebaseUser.displayName || undefined);
        userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
          console.error(`[firestoreService] Failed to create/retrieve user doc for ${userId}`);
          return null;
        }
      } else {
        return null;
      }
    }
    const userProfile = userDoc.data() as UserProfile;
    const userDisplayName = userProfile.displayName || userProfile.email?.split('@')[0] || 'User';

    if (!userProfile.organizationId) {
      console.log(`[firestoreService] User ${userId} has no primary/active organizationId set.`);
      return { organization: null, userRole: userProfile.role, userDisplayName };
    }

    console.log(`[firestoreService] Getting organization details for orgId: ${userProfile.organizationId}`);
    const orgRef = doc(db, 'organizations', userProfile.organizationId);
    const orgDoc = await getDoc(orgRef);
    if (!orgDoc.exists()) {
      console.warn(`[firestoreService] Organization ${userProfile.organizationId} not found for user ${userId}.`);
      // Clear the potentially stale organizationId from user's profile
      await updateDoc(userRef, { organizationId: null, role: null });
      return { organization: null, userRole: null, userDisplayName };
    }
    const orgData = orgDoc.data() as Omit<Organization, 'id' | 'createdAt'> & { createdAt: Timestamp };
    return {
      organization: {
        id: orgDoc.id,
        name: orgData.name,
        ownerUid: orgData.ownerUid,
        inviteCode: orgData.inviteCode,
        createdAt: orgData.createdAt.toDate(),
        memberUids: orgData.memberUids || [],
      },
      userRole: userProfile.role,
      userDisplayName,
    };
  } catch (error) {
    console.error(`[firestoreService] Error in getUserOrganizationDetails for user ${userId}:`, error);
    return null;
  }
};

export const getUserAssociatedOrganizations = async (userId: string): Promise<Organization[]> => {
  if (!db || !userId) {
    console.error("[firestoreService] DB not initialized or userId missing for getUserAssociatedOrganizations");
    return [];
  }
  console.log(`[firestoreService] Fetching associated organizations for user: ${userId}`);
  try {
    const ownedOrgsQuery = query(collection(db, 'organizations'), where("ownerUid", "==", userId));
    const memberOrgsQuery = query(collection(db, 'organizations'), where("memberUids", "array-contains", userId));

    const [ownedOrgsSnapshot, memberOrgsSnapshot] = await Promise.all([
      getDocs(ownedOrgsQuery),
      getDocs(memberOrgsQuery)
    ]);

    const organizationsMap = new Map<string, Organization>();

    const processSnapshot = (snapshot: typeof ownedOrgsSnapshot) => {
      snapshot.forEach(doc => {
        const data = doc.data();
        organizationsMap.set(doc.id, {
          id: doc.id,
          name: data.name,
          ownerUid: data.ownerUid,
          inviteCode: data.inviteCode,
          createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
          memberUids: data.memberUids || [],
        });
      });
    };

    processSnapshot(ownedOrgsSnapshot);
    processSnapshot(memberOrgsSnapshot); // Duplicates will be overwritten by map, which is fine.
    
    console.log(`[firestoreService] Found ${organizationsMap.size} associated organizations for user ${userId}`);
    return Array.from(organizationsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error(`[firestoreService] Error fetching associated organizations for user ${userId}:`, error);
    return [];
  }
};


export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  if (!db || !userId) {
     console.error("[firestoreService] DB not initialized or userId missing for getUserProfile");
    return null;
  }
  const userRef = doc(db, 'users', userId);
  try {
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      console.log(`[firestoreService] No user profile found for ${userId}`);
      return null;
    }
    const profile = userDoc.data() as UserProfile;
    if (!profile.displayName) {
        profile.displayName = profile.email?.split('@')[0] || 'User';
    }
    return profile;
  } catch (error) {
    console.error(`[firestoreService] Error fetching user profile for ${userId}:`, error);
    throw error;
  }
};

export const updateUserActiveOrganization = async (userId: string, organizationId: string | null, role: 'owner' | 'member' | null): Promise<void> => {
  if (!db || !userId) {
    console.error("[firestoreService] DB not initialized or userId missing for updateUserActiveOrganization");
    throw new Error("Prerequisites not met for updating active organization.");
  }
  const userRef = doc(db, 'users', userId);
  try {
    await updateDoc(userRef, {
      organizationId: organizationId,
      role: role,
    });
    console.log(`[firestoreService] Updated active organization for user ${userId} to ${organizationId} with role ${role}.`);
  } catch (error) {
    console.error(`[firestoreService] Error updating active organization for user ${userId}:`, error);
    throw error;
  }
};
