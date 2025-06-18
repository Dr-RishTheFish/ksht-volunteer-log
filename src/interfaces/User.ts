
export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  organizationId: string | null;
  role: 'owner' | 'member' | null; // Role within the organization
  createdAt: Date;
}
