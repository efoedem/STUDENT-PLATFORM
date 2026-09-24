/** Shape of the signed-in user, shared by client and server code. */
export type Viewer = {
  userId: string;
  email: string;
  roles: string[];
  isStaff: boolean;
  isAdmin: boolean;
  status: string;
};
