
import { db, auth } from './config';
import { doc, setDoc, getDoc, collection, addDoc, query, where, getDocs, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
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

export const createUserDocument = async (user: FirebaseUser): Promise<void> => {
  if (!db) {
    console.error("Firestore (db) is not initialized. Check Firebase configuration.");
    throw new Error("Firestore (db) is not initialized. Check Firebase configuration.");
  }
  if (!user) {
    console.error("User object is missing in createUserDocument.");
    throw new Error("User object is missing.");
  }
  
  const userRef = doc(db, 'users', user.uid);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) {
    try {
      const userProfile: UserProfile = { // Ensure all fields are present
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0] || 'Anonymous User',
        organizationId: null,
        role: null,
        createdAt: new Date(), 
      };
      await setDoc(userRef, userProfile);
    } catch (error) {
      console.error("Error creating user document in Firestore:", error);
      throw error; // Re-throw to be caught by calling UI
    }
  }
};

export const createOrganizationWithInviteCode = async (
  userId: string,
  orgName: string
): Promise<Organization> => {
  if (!db) {
    console.error("Firestore (db) is not initialized for createOrganizationWithInviteCode. Check Firebase configuration.");
    throw new Error("Firestore (db) is not initialized.");
  }
  if (!userId || !orgName) {
    throw new Error("Missing userId or orgName for creating organization.");
  }

  const inviteCode = generateInviteCode(8); // Increased length for better uniqueness
  const organizationsRef = collection(db, 'organizations');
  
  // Check if invite code already exists (highly unlikely with 8 chars, but good practice for larger scale)
  // For this app's scale, direct creation is likely fine.
  // let codeExists = true;
  // let uniqueInviteCode = inviteCode;
  // while(codeExists) {
  //   const q = query(organizationsRef, where("inviteCode", "==", uniqueInviteCode));
  //   const querySnapshot = await getDocs(q);
  //   if (querySnapshot.empty) {
  //     codeExists = false;
  //   } else {
  //     uniqueInviteCode = generateInviteCode(8);
  //   }
  // }


  try {
    const newOrgDocRef = await addDoc(organizationsRef, {
      name: orgName.trim(),
      ownerUid: userId,
      inviteCode: inviteCode, // Use uniqueInviteCode if implementing the loop above
      createdAt: serverTimestamp(), // Firestore server-side timestamp
      memberUids: [userId], // Initialize with the owner
    });

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      organizationId: newOrgDocRef.id,
      role: 'owner',
    });
    
    // Fetch the created org to get the server timestamp resolved
    const createdOrgDoc = await getDoc(newOrgDocRef);
    const orgData = createdOrgDoc.data();

    return {
      id: newOrgDocRef.id,
      name: orgData?.name,
      ownerUid: orgData?.ownerUid,
      inviteCode: orgData?.inviteCode,
      createdAt: (orgData?.createdAt as Timestamp)?.toDate() || new Date(),
    };

  } catch (error) {
    console.error("Error creating organization in Firestore:", error);
    throw error;
  }
};

export const joinOrganizationWithInviteCode = async (
  userId: string,
  inviteCode: string
): Promise<Organization | null> => {
  if (!db) {
    console.error("Firestore (db) is not initialized for joinOrganizationWithInviteCode. Check Firebase configuration.");
    throw new Error("Firestore (db) is not initialized.");
  }
   if (!userId || !inviteCode) {
    throw new Error("Missing userId or inviteCode for joining organization.");
  }

  const organizationsRef = collection(db, 'organizations');
  const q = query(organizationsRef, where("inviteCode", "==", inviteCode.trim().toUpperCase()));

  try {
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      console.log("No organization found with this invite code:", inviteCode.trim().toUpperCase());
      return null;
    }

    const orgDoc = querySnapshot.docs[0];
    const organizationId = orgDoc.id;
    const organizationData = orgDoc.data() as Omit<Organization, 'id' | 'createdAt'> & { createdAt: Timestamp; memberUids?: string[] };


    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      organizationId: organizationId,
      role: 'member',
    });

    // Add user to organization's member list (optional, but good for querying org members)
    const currentMemberUids = organizationData.memberUids || [];
    if (!currentMemberUids.includes(userId)) {
      await updateDoc(doc(db, 'organizations', organizationId), {
        memberUids: [...currentMemberUids, userId]
      });
    }

    return {
      id: organizationId,
      name: organizationData.name,
      ownerUid: organizationData.ownerUid,
      inviteCode: organizationData.inviteCode,
      createdAt: organizationData.createdAt.toDate(),
    };
  } catch (error) {
    console.error("Error joining organization in Firestore:", error);
    throw error;
  }
};

export const getUserOrganizationDetails = async (
  userId: string
): Promise<{ organization: Organization; userRole: UserProfile['role'] } | null> => {
  if (!db) {
    console.error("Firestore (db) is not initialized for getUserOrganizationDetails. Check Firebase configuration.");
    throw new Error("Firestore (db) is not initialized.");
  }
  if (!auth) {
    console.error("Firebase Auth is not initialized for getUserOrganizationDetails. Check Firebase configuration.");
    throw new Error("Firebase Auth is not initialized.");
  }
  if (!userId) {
    console.warn("No userId provided to getUserOrganizationDetails");
    return null;
  }

  const userRef = doc(db, 'users', userId);
  try {
    let userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.log("User document not found for UID:", userId, "- Attempting to create it if current user matches.");
      // This case might happen if user authenticated but their doc creation failed or was interrupted.
      const currentFirebaseUser = auth.currentUser;
      if (currentFirebaseUser && currentFirebaseUser.uid === userId) {
        try {
          await createUserDocument(currentFirebaseUser); // Try to create it
          userDoc = await getDoc(userRef); // Re-fetch
          if (!userDoc.exists()) {
            console.error("Failed to create and retrieve user document for UID:", userId);
            return null; // Still no doc after attempt
          }
        } catch (creationError) {
           console.error("Error attempting to create missing user document:", creationError);
           return null; // Failed to create
        }
      } else {
        console.warn("No authenticated user or UID mismatch, cannot create missing user document.");
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
      console.warn("Organization document not found for ID:", userProfile.organizationId, "- This might indicate data inconsistency.");
      // Consider clearing the user's orgId if the org doc is missing
      // await updateDoc(userRef, { organizationId: null, role: null });
      return null;
    }

    const orgData = orgDoc.data() as Omit<Organization, 'id' | 'createdAt'> & { createdAt: Timestamp };
    
    return {
      organization: {
        id: orgDoc.id,
        name: orgData.name,
        ownerUid: orgData.ownerUid,
        inviteCode: orgData.inviteCode, // Owners should see this
        createdAt: orgData.createdAt.toDate(),
      },
      userRole: userProfile.role,
    };
  } catch (error) {
    console.error("Error fetching user organization details from Firestore:", error);
    throw error; // Re-throw to be caught by calling function
  }
};

// Helper to get user profile (can be expanded)
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  if (!db) {
    console.error("Firestore (db) is not initialized for getUserProfile. Check Firebase configuration.");
    throw new Error("Firestore (db) is not initialized.");
  }
  if (!userId) return null;
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);
  return userDoc.exists() ? userDoc.data() as UserProfile : null;
};
