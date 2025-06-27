
import type { Timestamp } from "firebase/firestore";

export interface Organization {
  id: string;
  name: string;
  ownerUid: string;
  inviteCode: string;
  memberUids: string[];
  createdAt: Date | Timestamp;
}
