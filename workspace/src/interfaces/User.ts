
export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string; // Changed from optional to required for clarity
  organizationId: string | null;
  role: 'owner' | 'member' | null; // Role within the organization
  createdAt: Date;
}

