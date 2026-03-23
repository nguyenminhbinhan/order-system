export const jwtConstants = {
  secret: process.env.JWT_SECRET || 'supersecretjwtkey',
  expiresIn: '1h',
};
