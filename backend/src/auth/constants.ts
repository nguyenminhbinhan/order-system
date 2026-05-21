export const jwtConstants = {
  secret: process.env.JWT_SECRET || 'supersecretjwtkey',
  accessTokenExpiry: '8h' as const,
  refreshTokenExpiry: '7d' as const,
};
