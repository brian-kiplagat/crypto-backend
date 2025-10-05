import type { User } from '../../../schema/schema.js';

type UserResponse = {
  id: number;
  email: string;
  name: string;
  username: string | null;
  createdAt: Date | null;
  is_verified: boolean | null;
  role: string | null;
  phone: string | null;
  profile_picture: string | null;
  bio: string | null;
  health: 'active' | 'banned' | 'on_hold' | 'suspended' | 'blocked' | null;
  is_deleted: boolean | null;
  auth_provider: 'local' | 'google';
};

export async function serializeUser(user: User): Promise<UserResponse> {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    createdAt: user.createdAt,
    is_verified: user.is_verified,
    role: user.role,
    phone: user.phone,
    profile_picture: user.profile_picture,
    bio: user.bio,
    health: user.health,
    is_deleted: user.is_deleted,
    auth_provider: user.auth_provider ?? 'local',
  };
}
