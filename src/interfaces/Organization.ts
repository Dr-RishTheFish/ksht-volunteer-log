
export interface Organization {
  id: string;
  name: string;
  ownerUid: string;
  inviteCode: string;
  createdAt: Date;
  memberUids?: string[]; // Added to reflect actual data structure
}
